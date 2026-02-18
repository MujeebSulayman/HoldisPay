// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title HoldisInvoiceExtensions
 * @notice Additional functions to add to existing Holdis.sol contract
 * @dev These functions extend the invoice functionality with edit and delete
 */

// Add these functions to your existing Holdis.sol contract:

/**
 * @notice Edit an invoice (only if not funded yet)
 * @dev Only the issuer can edit, and only when status is Pending
 */
function editInvoice(
    uint256 invoiceId,
    address newPayer,
    address newReceiver,
    uint256 newAmount,
    string memory newDescription,
    string memory newAttachmentHash
) external whenNotPaused {
    Invoice storage invoice = invoices[invoiceId];
    
    require(invoice.issuer == msg.sender, "Not invoice issuer");
    require(invoice.status == InvoiceStatus.Pending, "Cannot edit funded invoice");
    require(newAmount >= platformSettings.minInvoiceAmount, "Amount too low");
    require(newAmount <= platformSettings.maxInvoiceAmount, "Amount too high");
    require(newPayer != address(0), "Invalid payer");
    require(newReceiver != address(0), "Invalid receiver");
    
    // Update invoice details
    InvoiceStatus oldStatus = invoice.status;
    invoice.payer = newPayer;
    invoice.receiver = newReceiver;
    invoice.amount = newAmount;
    invoice.description = newDescription;
    invoice.attachmentHash = newAttachmentHash;
    
    emit InvoiceUpdated(
        invoiceId,
        msg.sender,
        newPayer,
        newReceiver,
        newAmount,
        block.timestamp
    );
    
    emit InvoiceStatusUpdated(invoiceId, oldStatus, invoice.status, block.timestamp);
}

/**
 * @notice Delete/Cancel an invoice
 * @dev Can be called by issuer (anytime) or payer (if not delivered yet)
 */
function deleteInvoice(uint256 invoiceId, string memory reason) 
    external 
    whenNotPaused 
    nonReentrant 
{
    Invoice storage invoice = invoices[invoiceId];
    
    require(invoice.status != InvoiceStatus.Completed, "Already completed");
    require(invoice.status != InvoiceStatus.Cancelled, "Already cancelled");
    
    // Authorization check
    bool isIssuer = invoice.issuer == msg.sender;
    bool isPayer = invoice.payer == msg.sender;
    require(isIssuer || isPayer, "Not authorized");
    
    // If invoice is funded, refund the payer
    if (invoice.status == InvoiceStatus.Funded || invoice.status == InvoiceStatus.Delivered) {
        // Only issuer can cancel funded invoices
        require(isIssuer, "Only issuer can cancel funded invoice");
        
        // Refund to payer
        IERC20 token = IERC20(invoice.tokenAddress);
        require(token.transfer(invoice.payer, invoice.amount), "Refund failed");
    }
    
    InvoiceStatus oldStatus = invoice.status;
    invoice.status = InvoiceStatus.Cancelled;
    
    emit InvoiceCancelled(invoiceId, msg.sender, reason, block.timestamp);
    emit InvoiceStatusUpdated(invoiceId, oldStatus, InvoiceStatus.Cancelled, block.timestamp);
}

// Add this new event to your events section:
event InvoiceUpdated(
    uint256 indexed invoiceId,
    address indexed updatedBy,
    address newPayer,
    address newReceiver,
    uint256 newAmount,
    uint256 timestamp
);
