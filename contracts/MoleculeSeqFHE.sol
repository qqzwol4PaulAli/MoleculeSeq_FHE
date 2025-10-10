// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MoleculeSeqFHE is SepoliaConfig {
    struct EncryptedSequence {
        uint256 id;
        euint32 encryptedRead;      // Encrypted sequencing read
        euint32 encryptedMetadata;  // Encrypted metadata
        euint32 encryptedSampleId;  // Encrypted sample identifier
        uint256 submittedAt;
    }

    struct DecryptedSequence {
        string read;
        string metadata;
        string sampleId;
        bool revealed;
    }

    uint256 public sequenceCount;
    mapping(uint256 => EncryptedSequence) public encryptedSequences;
    mapping(uint256 => DecryptedSequence) public decryptedSequences;

    mapping(string => euint32) private encryptedSampleCounts;
    string[] private sampleList;

    mapping(uint256 => uint256) private decryptionRequests;

    event SequenceSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event SequenceDecrypted(uint256 indexed id);

    modifier onlyResearcher(uint256 sequenceId) {
        _;
    }

    /// @notice Submit an encrypted single-molecule sequencing read
    function submitEncryptedSequence(
        euint32 encryptedRead,
        euint32 encryptedMetadata,
        euint32 encryptedSampleId
    ) public {
        sequenceCount += 1;
        uint256 newId = sequenceCount;

        encryptedSequences[newId] = EncryptedSequence({
            id: newId,
            encryptedRead: encryptedRead,
            encryptedMetadata: encryptedMetadata,
            encryptedSampleId: encryptedSampleId,
            submittedAt: block.timestamp
        });

        decryptedSequences[newId] = DecryptedSequence({
            read: "",
            metadata: "",
            sampleId: "",
            revealed: false
        });

        emit SequenceSubmitted(newId, block.timestamp);
    }

    /// @notice Request decryption of a sequence
    function requestSequenceDecryption(uint256 sequenceId) public onlyResearcher(sequenceId) {
        EncryptedSequence storage seq = encryptedSequences[sequenceId];
        require(!decryptedSequences[sequenceId].revealed, "Already decrypted");

        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(seq.encryptedRead);
        ciphertexts[1] = FHE.toBytes32(seq.encryptedMetadata);
        ciphertexts[2] = FHE.toBytes32(seq.encryptedSampleId);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptSequence.selector);
        decryptionRequests[reqId] = sequenceId;

        emit DecryptionRequested(sequenceId);
    }

    /// @notice Callback for decrypted sequence
    function decryptSequence(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 sequenceId = decryptionRequests[requestId];
        require(sequenceId != 0, "Invalid request");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));
        DecryptedSequence storage dSeq = decryptedSequences[sequenceId];
        require(!dSeq.revealed, "Already decrypted");

        dSeq.read = results[0];
        dSeq.metadata = results[1];
        dSeq.sampleId = results[2];
        dSeq.revealed = true;

        if (!FHE.isInitialized(encryptedSampleCounts[dSeq.sampleId])) {
            encryptedSampleCounts[dSeq.sampleId] = FHE.asEuint32(0);
            sampleList.push(dSeq.sampleId);
        }
        encryptedSampleCounts[dSeq.sampleId] = FHE.add(
            encryptedSampleCounts[dSeq.sampleId],
            FHE.asEuint32(1)
        );

        emit SequenceDecrypted(sequenceId);
    }

    /// @notice Retrieve decrypted sequence data
    function getDecryptedSequence(uint256 sequenceId) public view returns (
        string memory read,
        string memory metadata,
        string memory sampleId,
        bool revealed
    ) {
        DecryptedSequence storage seq = decryptedSequences[sequenceId];
        return (seq.read, seq.metadata, seq.sampleId, seq.revealed);
    }

    /// @notice Get encrypted sample count
    function getEncryptedSampleCount(string memory sampleId) public view returns (euint32) {
        return encryptedSampleCounts[sampleId];
    }

    /// @notice Request decryption of sample counts
    function requestSampleCountDecryption(string memory sampleId) public {
        euint32 count = encryptedSampleCounts[sampleId];
        require(FHE.isInitialized(count), "Sample not found");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptSampleCount.selector);
        decryptionRequests[reqId] = uint256(keccak256(abi.encodePacked(sampleId)));
    }

    /// @notice Callback for decrypted sample count
    function decryptSampleCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 sampleHash = decryptionRequests[requestId];
        string memory sampleId = hashToSample(sampleHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    // Helper functions
    function hashToSample(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < sampleList.length; i++) {
            if (uint256(keccak256(abi.encodePacked(sampleList[i]))) == hash) {
                return sampleList[i];
            }
        }
        revert("Sample not found");
    }
}