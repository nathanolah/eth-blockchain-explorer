"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import styles from "./styles.css";
import { ethers } from 'ethers'; 

export default function Home() {
  const [searchVal, setSearchVal] = useState(undefined);
    const router = useRouter();

  const search = e => {
    e.preventDefault(); // Prevents the form from reloading the page
    // console.log(searchVal)
    if (ethers.isAddress(searchVal)) {
      router.push(`address/${searchVal}`);
    } else {
      router.push(`transaction/${searchVal}`);
    }
  }

  return (
    <main className={`container ${styles.main}`}>
      <header className="text-center my-4">
        <h1 className="display-4">Blockchain Explorer</h1>
        <p className="lead">Ethereum Blockchain Explorer</p>
      </header>
      <section className={`card p-4 shadow ${styles.content}`}>
        <form className="d-flex flex-column align-items-center">
          <div className="w-100" style={{ maxWidth: '400px' }}>
            <input
              className="form-control mb-3"
              type="text"
              placeholder="Search Transaction Hash / Address"
              onChange={e => setSearchVal(e.target.value)}
              value={searchVal}
            />
            <button
              className="btn btn-primary btn-block"
              type="submit"
              style={{ width: '100%' }}
              onClick={search}
            >
              Search
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
