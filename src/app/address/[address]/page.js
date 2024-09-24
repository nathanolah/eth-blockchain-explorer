import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import styles from "../../styles.css";
import moment from 'moment';
import { ethers } from "ethers";
import tokenJson from "../../token.json";
import multicallAbi from "../../multicall.json";

const infuraKey = process.env.INFURA_API_KEY;
const alchemyKey = process.env.ALCHEMY_API_KEY;
const moralisKey = process.env.MORALIS_API_KEY;
const infuraURL = `https://mainnet.infura.io/v3/${infuraKey}`
// const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;

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
            };
        })

        return tokenBalances;
    } catch (error) {
        console.error('Error in Multicall: ', error);
        return [];
    }
};

export default async function Address({ params }) {
    const balance = await getBalance(params.address);
    const data = await getTokenBalances(params.address);
    console.log(await getContractDetails(data, params.address));

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
            </section>
        </main>
    );
}