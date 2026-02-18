// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library PaymentLibrary {
    enum PaymentFrequency {
        WEEKLY,
        BI_WEEKLY,
        MONTHLY,
        QUARTERLY,
        CUSTOM
    }

    function calculateTotalAmount(
        uint256 paymentAmount,
        uint256 startDate,
        uint256 endDate,
        PaymentFrequency frequency
    ) internal pure returns (uint256) {
        uint256 duration = endDate - startDate;
        uint256 periods;

        if (frequency == PaymentFrequency.WEEKLY) {
            periods = duration / 7 days;
        } else if (frequency == PaymentFrequency.BI_WEEKLY) {
            periods = duration / 14 days;
        } else if (frequency == PaymentFrequency.MONTHLY) {
            periods = duration / 30 days;
        } else if (frequency == PaymentFrequency.QUARTERLY) {
            periods = duration / 90 days;
        } else {
            periods = 1;
        }

        return paymentAmount * (periods + 1);
    }

    function calculateNextPaymentDate(
        uint256 currentDate,
        uint256 paymentDay,
        PaymentFrequency frequency
    ) internal pure returns (uint256) {
        if (frequency == PaymentFrequency.WEEKLY) {
            return currentDate + 7 days;
        } else if (frequency == PaymentFrequency.BI_WEEKLY) {
            return currentDate + 14 days;
        } else if (frequency == PaymentFrequency.MONTHLY) {
            return currentDate + 30 days;
        } else if (frequency == PaymentFrequency.QUARTERLY) {
            return currentDate + 90 days;
        }
        return currentDate;
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
