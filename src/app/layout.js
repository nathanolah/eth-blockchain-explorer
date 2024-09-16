import { Inter } from "next/font/google";
import 'bootstrap/dist/css/bootstrap.min.css';
import "./styles.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Blockchain Explorer",
  description: "Ethereum Blockchain Explorer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
