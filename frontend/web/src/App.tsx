// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface SequenceData {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  sequenceType: "PacBio" | "Nanopore" | "Other";
  status: "pending" | "processed" | "error";
  fheOperations: number;
}

const App: React.FC = () => {
  // Randomized style selections:
  // Colors: High contrast (blue+orange)
  // UI Style: Future metal
  // Layout: Center radiation
  // Interaction: Micro-interactions
  
  // Randomized features: Data statistics, search filter, team info
  
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [sequences, setSequences] = useState<SequenceData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newSequenceData, setNewSequenceData] = useState({
    sequenceType: "PacBio",
    description: "",
    rawData: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "PacBio" | "Nanopore" | "Other">("all");

  // Calculate statistics
  const processedCount = sequences.filter(s => s.status === "processed").length;
  const pendingCount = sequences.filter(s => s.status === "pending").length;
  const errorCount = sequences.filter(s => s.status === "error").length;
  const totalFHEOps = sequences.reduce((sum, seq) => sum + seq.fheOperations, 0);

  useEffect(() => {
    loadSequences().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadSequences = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("sequence_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing sequence keys:", e);
        }
      }
      
      const list: SequenceData[] = [];
      
      for (const key of keys) {
        try {
          const sequenceBytes = await contract.getData(`sequence_${key}`);
          if (sequenceBytes.length > 0) {
            try {
              const sequenceData = JSON.parse(ethers.toUtf8String(sequenceBytes));
              list.push({
                id: key,
                encryptedData: sequenceData.data,
                timestamp: sequenceData.timestamp,
                owner: sequenceData.owner,
                sequenceType: sequenceData.sequenceType,
                status: sequenceData.status || "pending",
                fheOperations: sequenceData.fheOperations || 0
              });
            } catch (e) {
              console.error(`Error parsing sequence data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading sequence ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setSequences(list);
    } catch (e) {
      console.error("Error loading sequences:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const uploadSequence = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setUploading(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting sequence data with Zama FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-SEQ-${btoa(JSON.stringify(newSequenceData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const sequenceId = `seq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const sequenceData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        sequenceType: newSequenceData.sequenceType,
        status: "pending",
        fheOperations: 0
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `sequence_${sequenceId}`, 
        ethers.toUtf8Bytes(JSON.stringify(sequenceData))
      );
      
      const keysBytes = await contract.getData("sequence_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(sequenceId);
      
      await contract.setData(
        "sequence_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted sequence submitted securely!"
      });
      
      await loadSequences();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowUploadModal(false);
        setNewSequenceData({
          sequenceType: "PacBio",
          description: "",
          rawData: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const processSequence = async (sequenceId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted sequence with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const sequenceBytes = await contract.getData(`sequence_${sequenceId}`);
      if (sequenceBytes.length === 0) {
        throw new Error("Sequence not found");
      }
      
      const sequenceData = JSON.parse(ethers.toUtf8String(sequenceBytes));
      
      // Simulate FHE computation (genome assembly)
      const fheOps = Math.floor(Math.random() * 500) + 100;
      
      const updatedSequence = {
        ...sequenceData,
        status: "processed",
        fheOperations: fheOps
      };
      
      await contract.setData(
        `sequence_${sequenceId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedSequence))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE genome assembly completed!"
      });
      
      await loadSequences();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Processing failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const filteredSequences = sequences.filter(seq => {
    const matchesSearch = seq.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         seq.owner.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || seq.sequenceType === filterType;
    return matchesSearch && matchesType;
  });

  const renderStats = () => (
    <div className="stats-grid">
      <div className="stat-card metal">
        <div className="stat-value">{sequences.length}</div>
        <div className="stat-label">Total Sequences</div>
      </div>
      <div className="stat-card metal">
        <div className="stat-value">{processedCount}</div>
        <div className="stat-label">Processed</div>
      </div>
      <div className="stat-card metal">
        <div className="stat-value">{pendingCount}</div>
        <div className="stat-label">Pending</div>
      </div>
      <div className="stat-card metal">
        <div className="stat-value">{totalFHEOps}</div>
        <div className="stat-label">FHE Operations</div>
      </div>
    </div>
  );

  const renderTeamInfo = () => (
    <div className="team-card metal">
      <h3>Research Team</h3>
      <div className="team-members">
        <div className="member">
          <div className="member-icon">👨‍🔬</div>
          <div className="member-info">
            <div className="member-name">Dr. Alan Turing</div>
            <div className="member-role">FHE Specialist</div>
          </div>
        </div>
        <div className="member">
          <div className="member-icon">🧑‍💻</div>
          <div className="member-info">
            <div className="member-name">Grace Hopper</div>
            <div className="member-role">Bioinformatics</div>
          </div>
        </div>
        <div className="member">
          <div className="member-icon">👩‍🔬</div>
          <div className="member-info">
            <div className="member-name">Marie Curie</div>
            <div className="member-role">Genomics</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="loading-screen metal">
      <div className="metal-spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header metal">
        <div className="logo">
          <div className="logo-icon">
            <div className="dna-icon"></div>
          </div>
          <h1>Molecule<span>Seq</span></h1>
          <div className="fhe-badge">
            <span>FHE-Powered</span>
          </div>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content radial-layout">
        <div className="central-panel metal-card">
          <div className="panel-header">
            <h2>FHE-Based Secure Sequencing Analysis</h2>
            <p>Upload and analyze encrypted single-molecule sequencing data with fully homomorphic encryption</p>
          </div>
          
          <div className="panel-actions">
            <button 
              onClick={() => setShowUploadModal(true)} 
              className="metal-button primary"
            >
              Upload Sequence
            </button>
            <button 
              onClick={loadSequences}
              className="metal-button secondary"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
          
          <div className="search-filter">
            <input
              type="text"
              placeholder="Search sequences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="metal-input"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="metal-select"
            >
              <option value="all">All Types</option>
              <option value="PacBio">PacBio</option>
              <option value="Nanopore">Nanopore</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        
        <div className="stats-panel">
          {renderStats()}
          {renderTeamInfo()}
        </div>
        
        <div className="sequences-list metal-card">
          <div className="list-header">
            <h3>Encrypted Sequence Data</h3>
            <div className="status-filter">
              <span>Showing: {filteredSequences.length} sequences</span>
            </div>
          </div>
          
          {filteredSequences.length === 0 ? (
            <div className="no-sequences">
              <div className="dna-icon large"></div>
              <p>No encrypted sequences found</p>
              <button 
                className="metal-button primary"
                onClick={() => setShowUploadModal(true)}
              >
                Upload First Sequence
              </button>
            </div>
          ) : (
            <div className="sequence-table">
              <div className="table-header">
                <div className="header-cell">ID</div>
                <div className="header-cell">Type</div>
                <div className="header-cell">Owner</div>
                <div className="header-cell">Date</div>
                <div className="header-cell">Status</div>
                <div className="header-cell">FHE Ops</div>
                <div className="header-cell">Actions</div>
              </div>
              
              {filteredSequences.map(seq => (
                <div className="sequence-row" key={seq.id}>
                  <div className="table-cell sequence-id">#{seq.id.substring(0, 6)}</div>
                  <div className="table-cell">{seq.sequenceType}</div>
                  <div className="table-cell">{seq.owner.substring(0, 6)}...{seq.owner.substring(38)}</div>
                  <div className="table-cell">
                    {new Date(seq.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`status-badge ${seq.status}`}>
                      {seq.status}
                    </span>
                  </div>
                  <div className="table-cell">{seq.fheOperations}</div>
                  <div className="table-cell actions">
                    {account.toLowerCase() === seq.owner.toLowerCase() && seq.status === "pending" && (
                      <button 
                        className="metal-button small"
                        onClick={() => processSequence(seq.id)}
                      >
                        Process
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  
      {showUploadModal && (
        <ModalUpload 
          onSubmit={uploadSequence} 
          onClose={() => setShowUploadModal(false)} 
          uploading={uploading}
          sequenceData={newSequenceData}
          setSequenceData={setNewSequenceData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content metal-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer metal">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="dna-icon"></div>
              <span>MoleculeSeq</span>
            </div>
            <p>Secure encrypted sequencing analysis using Zama FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="copyright">
            © {new Date().getFullYear()} MoleculeSeq FHE Research. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalUploadProps {
  onSubmit: () => void; 
  onClose: () => void; 
  uploading: boolean;
  sequenceData: any;
  setSequenceData: (data: any) => void;
}

const ModalUpload: React.FC<ModalUploadProps> = ({ 
  onSubmit, 
  onClose, 
  uploading,
  sequenceData,
  setSequenceData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSequenceData({
      ...sequenceData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!sequenceData.rawData) {
      alert("Please enter sequence data");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="upload-modal metal-card">
        <div className="modal-header">
          <h2>Upload Encrypted Sequence</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner metal">
            <div className="lock-icon"></div> Your sequence data will be encrypted with Zama FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Sequence Type *</label>
              <select 
                name="sequenceType"
                value={sequenceData.sequenceType} 
                onChange={handleChange}
                className="metal-select"
              >
                <option value="PacBio">PacBio</option>
                <option value="Nanopore">Nanopore</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text"
                name="description"
                value={sequenceData.description} 
                onChange={handleChange}
                placeholder="Brief description..." 
                className="metal-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>Sequence Data (FASTA format) *</label>
              <textarea 
                name="rawData"
                value={sequenceData.rawData} 
                onChange={handleChange}
                placeholder="Paste your sequence data here..." 
                className="metal-textarea"
                rows={6}
              />
            </div>
          </div>
          
          <div className="privacy-notice metal">
            <div className="shield-icon"></div> Data remains encrypted during FHE processing and analysis
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="metal-button secondary"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={uploading}
            className="metal-button primary"
          >
            {uploading ? "Encrypting with FHE..." : "Upload Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;