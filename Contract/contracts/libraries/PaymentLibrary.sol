// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library PaymentLibrary {
    function calculateTotalAmount(
        uint256 paymentAmount,
        uint256 numberOfPayments
    ) internal pure returns (uint256) {
        return paymentAmount * numberOfPayments;
    }

    function calculateFee(uint256 amount, uint256 feePercentage) 
        internal 
        pure 
        returns (uint256 fee, uint256 netAmount) 
    {
        fee = (amount * feePercentage) / 10000;
        netAmount = amount - fee;
    }
}
