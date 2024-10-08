import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import styles from "../../styles.css";
import moment from 'moment';
import { ethers } from "ethers";
import { TickMath, FullMath } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import tokenJson from "../../token.json";
import multicallAbi from "../../multicall.json";

const infuraKey = process.env.INFURA_API_KEY;
const moralisKey = process.env.MORALIS_API_KEY;
const infuraURL = `https://mainnet.infura.io/v3/${infuraKey}`

//
// use uniswap factory to get the pool
const UNISWAP_V3_FACTORY_ADDR = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    
// ABI for Uniswap V3 Factory
const UniswapV3FactoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)"
];

// ABI for Uniswap V3 Pool to get slot0 (tick data)
const UniswapV3PoolABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

// Get the current market price for ETH/USD pair
const getEthUSDPrice = async () => {
    const WETH_ADDR = `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`;
    const moralisURL = `https://deep-index.moralis.io/api/v2.2/erc20/${WETH_ADDR}/price?chain=eth&include=percent_change`
    const res = await fetch(moralisURL, {
        mehtod: "GET",
        headers: {
            "accept": "application/json",
            "X-API-Key": `${moralisKey}`
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch token details");
    }
    
    const data = await res.json();
    return data;
}

// Get token balances for Ethereum address
const getTokenBalances = async (address) => {
    const moralisURL = `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=eth&exclude_spam=true`
    const res = await fetch(moralisURL, {
        mehtod: "GET",
        headers: {
            "accept": "application/json",
            "X-API-Key": `${moralisKey}`
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch token details");
    }

    const data = await res.json();
    return data;
}

// Get ETH balance for address
const getBalance = async (address) => {
    const res = await fetch(infuraURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to address details");
    }

    const data = await res.json();
    return data.result;
}

// Fetch ERC20 token details for the wallet address by the token contract address via multicall
const getContractDetails = async (tokensData, walletAddr) => {
    const provider = new ethers.JsonRpcProvider(infuraURL);
    const multicallAddr = "0x5ba1e12693dc8f9c48aad8770482f4739beed696";
    const multicallContract = new ethers.Contract(multicallAddr, multicallAbi, provider);

    // Prepare the calldata for all tokens
    const calls = tokensData.flatMap(token => {
        const contractInterface = new ethers.Interface(tokenJson.abi);

        return [
            // Call balanceOf(walletAddr), decimals(), name(), and symbol()
            {
                target: token.token_address,
                callData: contractInterface.encodeFunctionData('balanceOf', [walletAddr]),
            },
            {
                target: token.token_address,
                callData: contractInterface.encodeFunctionData('decimals', []),
            },
            {
                target: token.token_address,
                callData: contractInterface.encodeFunctionData('name', []),
            },
            {
                target: token.token_address,
                callData: contractInterface.encodeFunctionData('symbol', []),
            }
        ];
    });

    try {
        // Aggregate call using multicall
        const [, returnData] = await multicallContract.aggregate(calls);

        const tokenBalances = tokensData.map((token, index) => {
            const balanceData = returnData[index * 4]; // balanceOf result
            const decimalsData = returnData[index * 4 + 1]; // decimals result
            const nameData = returnData[index * 4 + 2]; // name result
            const symbolData = returnData[index * 4 + 3]; // symbol result

            // Decode the returned data
            const contractInterface = new ethers.Interface(tokenJson.abi);
            const balance = contractInterface.decodeFunctionResult('balanceOf', balanceData)[0];
            const decimals = contractInterface.decodeFunctionResult('decimals', decimalsData)[0];
            const name = contractInterface.decodeFunctionResult('name', nameData)[0];
            const symbol = contractInterface.decodeFunctionResult('symbol', symbolData)[0];

            return {
                tokenAddress: token.token_address,
                balance: ethers.formatUnits(balance, decimals),
                name,
                symbol,
                decimals
            };
        })

        return tokenBalances;
    } catch (error) {
        console.error('Error in Multicall: ', error);
        return [];
    }
};

// Gets tick for pair and calculates price quote
const getPriceQuote = async (baseToken, quoteToken, baseDecimal, inputAmount) => {
    // Get the current tick for pair from the Uniswap pool contract
    // Fee tiers for Uniswap V3 (in basis points)
    // const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, and 1%
    const provider = new ethers.JsonRpcProvider(infuraURL);
    const FEE_TIERS = [3000]
    const factoryContract = new ethers.Contract(UNISWAP_V3_FACTORY_ADDR, UniswapV3FactoryABI, provider);
    const calls = [];

    for (const fee of FEE_TIERS) {
        const poolAddress = await factoryContract.getPool(baseToken, quoteToken, fee);
        
        if (poolAddress !== "0x0000000000000000000000000000000000000000") {
            const poolContract = new ethers.Contract(poolAddress, UniswapV3PoolABI, provider);
            calls.push({
                target: poolAddress,
                callData: poolContract.interface.encodeFunctionData("slot0")
            });
        }
    }
    
    // if (calls.length === 0) {
    //     throw new Error("No pools found for this token pair");
    // }

    // for each call decode the functions of the pool contract using UniswapPoolABI
    const multicallAddr = "0x5ba1e12693dc8f9c48aad8770482f4739beed696";
    const multicallContract = new ethers.Contract(multicallAddr, multicallAbi, provider);

    try {
        const [, returnData] = await multicallContract.aggregate(calls);
        let bestPrice = null
        let bestPool = null;

        for (let i = 0; i < returnData.length; i++) {
            const contractInterface = new ethers.Interface(UniswapV3PoolABI);
            const decodedData = contractInterface.decodeFunctionResult('slot0', returnData[i]);
            const currentTick = decodedData[1];

            const baseTokenDecimal = baseDecimal;
            const quoteTokenDecimal = 18; // ETH decimal

            const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(Number(currentTick));
            const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96);
            const baseAmount = JSBI.BigInt(inputAmount * (10**baseTokenDecimal));
            const shift = JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(192));
    
            const quoteAmount = FullMath.mulDivRoundingUp(ratioX192, baseAmount, shift);
            const value = quoteAmount.toString() / 10**quoteTokenDecimal;
            const poolAddress = calls[i].target;
    
            // console.log(`Price for pool ${poolAddress}: ${value}`);
    
            if (!bestPrice || value < bestPrice) {
                bestPrice = value;
                bestPool = poolAddress;
            }

        }

        // Best price in ETH
        // console.log(`Best price: ${bestPrice}, from pool: ${bestPool}`);
        const ETHUSD = await getEthUSDPrice();
        const currentValue = bestPrice * ETHUSD.usdPrice;

        return {
            currentValue,
            bestPool
        };

    } catch (error) {
        console.error('Error in Multicall: ', error);
        return [];
    }
}

export default async function Address({ params }) {
    const balance = await getBalance(params.address);
    const data = await getTokenBalances(params.address);
    const contractsData = await getContractDetails(data, params.address);

    // Get ETH/USD value from chainlink oracle.

    // USE FOR TESTING
    // const result = await getPriceQuote(
    //     "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    //     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    //     8, // decimal
    //     1
    // );

    const priceQuotes = await Promise.all(
        contractsData.map(async (contract) => {
            const quote = await getPriceQuote(
                contract.tokenAddress,
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                Number(contract.decimals),
                contract.balance
            );
            return { ...contract, priceQuote: quote};
        })      
    );

    return (
        <main className={`container ${styles.main}`}>
            <header className="text-center my-4">
                <h1 className="display-4">Blockchain Explorer</h1>
                <p className="lead">Ethereum Blockchain Explorer</p>
            </header>
        
            <section className={`card p-4 shadow ${styles.content}`}>
                <div id="content" className="text-center">
                    <h2 className="h5 mb-3">Address Details</h2>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Address:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{params.address}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">ETH Balance:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{ethers.formatEther(balance)} ETH</p>
                    </div>
                </div>

                {/* Display each token's details */}
                <div className="mt-4">
                    <h3 className="h5 mb-3">Token Details</h3>
                    <div className="row">
                        {priceQuotes.map((token, index) => (
                            <div key={index} className="col-md-4 mb-3">
                                <div className="card token-card p-3">
                                    <h4 className="h6 font-weight-bold mb-1">{token.symbol}</h4>
                                    <p className="text-muted mb-0">
                                        Token Address: {token.tokenAddress}
                                    </p>
                                    <p className="mb-0">
                                        Balance: {token.balance}
                                    </p>
                                    <p className="mb-0">
                                        ${token.priceQuote.currentValue} USD
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}