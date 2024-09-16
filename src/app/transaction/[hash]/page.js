import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import styles from "../../styles.css";
import moment from 'moment';
import { ethers } from "ethers";

const infuraKey = process.env.INFURA_API_KEY;
const infuraURL = `https://mainnet.infura.io/v3/${infuraKey}`

// Get transaction details by transaction hash
const getTxReceipt = async (txHash) => {
    const res = await fetch(infuraURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionReceipt",
            params: [txHash],
            id: 1
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch transaction receipt");
    }

    const data = await res.json();
    return data.result;
}

const getTxByHash = async (txHash) => {
    const res = await fetch(infuraURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionByHash",
            params: [txHash],
            id: 3
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch transaction details");
    }

    const data = await res.json();
    return data.result;
}

// Get block details by block hash
const getBlockByHash = async (blockHash) => {
    const res = await fetch(infuraURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBlockByHash",
            params: [blockHash, false],
            id: 2
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to fetch block");
    }

    const data = await res.json();
    return data.result;
}

export default async function Transaction({ params }) {
    const receipt = await getTxReceipt(params.hash);
    const block = await getBlockByHash(receipt.blockHash);
    const tx = await getTxByHash(params.hash);

    const gasPrice = parseInt(receipt.effectiveGasPrice);
    const gasUsed = parseInt(receipt.gasUsed);
    const txFee = (gasUsed * gasPrice) / 10 ** 18;

    return (
        <main className={`container ${styles.main}`}>
            <header className="text-center my-4">
                <h1 className="display-4">Blockchain Explorer</h1>
                <p className="lead">Ethereum Blockchain Explorer</p>
            </header>

            <section className={`card p-4 shadow ${styles.content}`}>
                <div id="content" className="text-center">
                    <h2 className="h5 mb-3">Transaction Details</h2>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Transaction Hash:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{params.hash}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center mt-3">
                        <p className="text-muted mb-0">Status:&nbsp;</p>
                        <div
                            id={receipt.status === "0x1" ? 'success' : 'failure'}
                            className="d-inline-flex align-items-center ml-2"
                        >
                            {receipt.status === "0x1" ? (
                                <span><i className="bi bi-check-circle-fill mr-2"></i><span style={{ marginLeft: "5px" }}>Success</span></span>
                            ) : (
                                <span><i className="bi bi-x-circle-fill mr-2"></i><span style={{ marginLeft: "5px" }}>Failure</span></span>
                            )}
                        </div>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Block Number:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{Number(receipt.blockNumber)}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Block Timestamp:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2"><i className='bi bi-clock'></i> {moment.unix(block.timestamp).fromNow()}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">From:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{receipt.from}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">To:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{receipt.to}</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Value:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{ethers.formatEther(tx.value)} ETH</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Transaction Fee:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{txFee} ETH</p>
                    </div>
                    <div className="d-flex justify-content-center align-items-center">
                        <p className="text-muted mb-0">Gas Price:&nbsp;</p>
                        <p className="font-weight-bold text-break mb-0 ml-2">{gasPrice / 10 ** 9} Gwei</p>
                    </div>
                </div>
            </section>
        </main>
    );
}
