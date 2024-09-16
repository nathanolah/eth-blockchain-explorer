import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import styles from "../../styles.css";
import moment from 'moment';
import { ethers } from "ethers";
import tokenJson from "../../token.json";

const infuraKey = process.env.INFURA_API_KEY;
const alchemyKey = process.env.ALCHEMY_API_KEY;
const moralisKey = process.env.MORALIS_API_KEY;
const infuraURL = `https://mainnet.infura.io/v3/${infuraKey}`
const alchemyURL = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;

// 
const provider = new providers.JsonRpcProvider(infuraURL)

// Get token balances for Ethereum address
const getTokenBalances = async (address) => {
    const moralisURL = `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=eth`
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

// Fetch ERC20 token details by contract address
const getContractDetails = async (contractAddress) => {
    const contract = new ethers.Contract(contractAddress, tokenJson.abi, provider);

    try {
        const name = await contract.name();
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        const totalSupply = await contract.totalSupply();
    
        console.log(`Name: ${name}`)
        console.log(`Symbol: ${symbol}`)
        console.log(`Decimals: ${decimals}`)
        console.log(`Total Supply: ${totalSupply}`)

    } catch (error) {
        console.error('Error fetching contract details: ', error);
    }
}

export default async function Address({ params }) {
    const balance = await getBalance(params.address);
    const data = await getTokenBalances(params.address);

    data.forEach(token => {
        // console.log(token.token_address)
        getContractDetails(token.token_address);
    });
    // console.log("api response", data || "no data")

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