# MoleculeSeq FHE Analysis

A cloud-based platform enabling researchers to securely upload and analyze encrypted single-molecule sequencing data. Leveraging fully homomorphic encryption (FHE), the platform allows genome assembly and structural variation analysis without exposing raw sequencing reads from technologies like PacBio and Nanopore.

## Project Motivation

Single-molecule sequencing generates highly sensitive genomic information, and sharing it across institutions or cloud platforms poses privacy and intellectual property challenges:

* Data confidentiality: Raw reads often contain sensitive genetic information.
* Regulatory compliance: Patient or organism data must adhere to strict privacy regulations.
* Collaborative analysis barriers: Multiple labs or cloud platforms cannot compute on shared data without exposing raw reads.

Our platform solves these issues by allowing encrypted computation with FHE, enabling:

* Secure genome assembly from encrypted sequencing data.
* Structural variant analysis without ever decrypting the raw reads.
* Collaborative computation across research institutions while preserving data privacy.

## Features

### Core Functionality

* **Encrypted Data Upload**: Researchers upload single-molecule reads fully encrypted.
* **FHE-based Computation**: Genome assembly and analysis performed on encrypted datasets.
* **Structural Variant Detection**: Identify large-scale genomic changes without accessing raw reads.
* **Immutable Data Logging**: Submissions are recorded securely on the blockchain to ensure integrity.

### Privacy & Security

* **Client-side Encryption**: Data encrypted before leaving the researcher's environment.
* **Data Ownership**: Researchers retain full control over their datasets.
* **Immutable Records**: Once uploaded, data cannot be altered or removed.
* **Encrypted Analytics**: Computation on encrypted data protects sensitive information.

### Analytical Insights

* **Genome Assembly Metrics**: Evaluate assembly quality without revealing underlying reads.
* **Structural Variation Summary**: Get insights into insertions, deletions, and rearrangements.
* **Cross-institution Collaboration**: Aggregate encrypted results across institutions without raw data exposure.

## Architecture

### Smart Contracts

* **MoleculeSeqFHE.sol**

  * Handles encrypted data submissions.
  * Maintains immutable on-chain records.
  * Tracks analysis requests and results securely.
  * Facilitates FHE-based decryption requests with verified proofs.

### Frontend Application

* **React + TypeScript**: Interactive interface for data upload, analysis, and visualization.
* **Ethers.js**: Manages interactions with Ethereum smart contracts.
* **Dashboard Visualization**: Real-time display of assembly metrics and variant summaries.
* **Search & Filter**: Locate datasets or analysis results efficiently.

## Technology Stack

### Blockchain & FHE

* **Solidity ^0.8.24**: Smart contract logic.
* **FHE Library**: Supports encrypted computation for secure genomic analysis.
* **Ethereum Sepolia Testnet**: Deployment environment.

### Frontend

* **React 18 + TypeScript**: Responsive UI framework.
* **Tailwind CSS**: Modern styling and layout.
* **Ethers.js**: Blockchain integration for submission and result retrieval.

## Installation

### Prerequisites

* Node.js 18+
* npm / yarn / pnpm
* Ethereum wallet for optional contract interactions

### Setup

1. Install dependencies: `npm install`
2. Compile smart contracts: `npx hardhat compile`
3. Deploy contracts to Ethereum testnet
4. Run frontend: `npm run dev`

## Usage

* Upload encrypted single-molecule sequencing data.
* Request encrypted analysis such as genome assembly and structural variant detection.
* View aggregated metrics and insights.
* Collaborate with other institutions without exposing raw reads.

## Security Highlights

* Fully homomorphic encryption ensures computations without data exposure.
* Blockchain guarantees immutable logging of submissions and analysis requests.
* Access control ensures only authorized decryption or analysis triggers.
* Aggregated results protect sensitive genomic information while providing actionable insights.

## Roadmap

* Expand analysis modules with additional genomic metrics.
* Multi-cloud support for collaborative FHE computation.
* Mobile interface for data monitoring and visualization.
* Integration with lab sequencing platforms for automated uploads.
* Community-driven algorithm enhancements for genome assembly and variant detection.

Built with ❤️ to enable secure, privacy-preserving, and collaborative genomic research in the cloud.
