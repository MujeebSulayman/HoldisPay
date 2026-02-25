import { Request, Response } from 'express';
import { blockradarService } from '../services/blockradar.service';
import { userWalletService } from '../services/user-wallet.service';
import { userService } from '../services/user.service';
import { contractService } from '../services/contract.service';
import { invoiceService } from '../services/invoice.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

export class InvoiceController {
  
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        amount,
        description,
        customerEmail,
        customerName,
        dueDate,
        businessName,
        businessAddress,
        lineItems,
        vatPercent,
        processingFeePercent,
        currency,
      } = req.body;

      if (!userId || !amount || !description) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'userId, amount, and description are required',
        });
        return;
      }

      if (!dueDate || typeof dueDate !== 'string' || !dueDate.trim()) {
        res.status(400).json({
          error: 'Missing required field',
          message: 'dueDate (expire date) is required',
        });
        return;
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      const reference = `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      logger.info('Creating invoice', {
        userId,
        reference,
        amount,
        customerEmail,
      });

      const paymentLink = await blockradarService.createPaymentLink({
        name: customerName ? `Invoice for ${customerName}` : `Invoice ${reference}`,
        description: description,
        amount: amount,
        redirectUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/dashboard/invoices?payment=success` : undefined,
        successMessage: 'Payment received! The merchant has been notified.',
        metadata: {
          invoiceReference: reference,
          userId,
          issuerEmail: user.email,
          customerEmail: customerEmail || null,
          customerName: customerName || null,
        },
        paymentLimit: 1,
      });

      logger.info('Payment link created for invoice', {
        reference,
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
      });

      const { data: invoiceRecord, error: dbError } = await supabase
        .from('invoices')
        .insert({
          invoice_id: Date.now(),
          issuer_id: userId,
          amount,
          description,
          customer_email: customerEmail || null,
          customer_name: customerName || null,
          due_date: dueDate,
          status: 'pending',
          payment_link_id: paymentLink.id,
          payment_link_url: paymentLink.url,
          payment_link_slug: paymentLink.slug,
          business_name: businessName || null,
          business_address: businessAddress || null,
          line_items: lineItems && Array.isArray(lineItems) ? lineItems : null,
          vat_percent: vatPercent != null ? Number(vatPercent) : null,
          processing_fee_percent: processingFeePercent != null ? Number(processingFeePercent) : null,
          currency: currency || 'USD',
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Failed to store invoice in database', { error: dbError });
        throw new Error('Failed to store invoice record');
      }

      logger.info('Invoice stored in database', {
        invoiceId: invoiceRecord.id,
        reference,
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoiceRecord,
      });
    } catch (error) {
      logger.error('Create invoice API error', { error });
      res.status(500).json({
        error: 'Failed to create invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async fundInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { userId } = req.body; 
      if (!userId) {
        res.status(400).json({
          error: 'Missing userId',
          message: 'Payer userId is required',
        });
        return;
      }

            const invoice = await contractService.getInvoice(BigInt(invoiceId));
      if (!invoice) {
        res.status(404).json({
          error: 'Invoice not found',
        });
        return;
      }

            const addressId = await userService.getUserWalletAddressId(userId);

            const isERC20 = invoice.tokenAddress !== '0x0000000000000000000000000000000000000000';

            const approveAbi = [
        {
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ];

      const markFundedAbi = [
        {
          name: 'markAsFunded',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: '_invoiceId', type: 'uint256' }],
          outputs: [],
        },
      ];

            if (isERC20) {
                const gasEstimate = await userWalletService.estimateNetworkFeeForChildAddress(
          addressId,
          {
            address: invoice.tokenAddress,
            method: 'approve',
            parameters: [env.HOLDIS_CONTRACT_ADDRESS, invoice.amount.toString()],
            abi: approveAbi,
          }
        );

        logger.info('Gas estimate for approve + fund', {
          invoiceId,
          gas: gasEstimate.networkFee,
          gasUSD: gasEstimate.networkFeeInUSD,
        });

                if (parseFloat(gasEstimate.nativeBalance) < parseFloat(gasEstimate.networkFee) * 2) {
          res.status(400).json({
            error: 'Insufficient gas balance',
            message: 'Not enough native token for gas fees',
            data: {
              required: parseFloat(gasEstimate.networkFee) * 2,
              available: gasEstimate.nativeBalance,
            },
          });
          return;
        }

                const batchResult = await blockradarService.writeContract({
          calls: [
            {
              address: invoice.tokenAddress,
              method: 'approve',
              parameters: [env.HOLDIS_CONTRACT_ADDRESS, invoice.amount.toString()],
              abi: approveAbi,
              reference: `approve-${invoiceId}-${Date.now()}`,
              metadata: {
                userId,
                invoiceId,
                type: 'token_approval',
                step: 1,
              },
            },
            {
              address: env.HOLDIS_CONTRACT_ADDRESS,
              method: 'markAsFunded',
              parameters: [invoiceId],
              abi: markFundedAbi,
              reference: `fund-${invoiceId}-${Date.now()}`,
              metadata: {
                userId,
                invoiceId,
                type: 'invoice_funding',
                step: 2,
              },
            },
          ],
        } as any);

        logger.info('Batch funding initiated', {
          invoiceId,
          userId,
          success: (batchResult as any).success?.length || 0,
          errors: (batchResult as any).errors?.length || 0,
        });

        res.status(200).json({
          success: true,
          message: 'Invoice funding batch initiated',
          data: {
            operations: (batchResult as any).success,
            errors: (batchResult as any).errors,
          },
        });
      } else {
                const result = await userWalletService.writeContractFromChildAddress(addressId, {
          address: env.HOLDIS_CONTRACT_ADDRESS,
          method: 'markAsFunded',
          parameters: [invoiceId],
          abi: markFundedAbi,
          reference: `fund-${invoiceId}-${Date.now()}`,
          metadata: {
            userId,
            invoiceId,
            type: 'invoice_funding',
            tokenType: 'native',
          },
        });

        res.status(200).json({
          success: true,
          message: 'Invoice funding initiated',
          data: {
            txId: result.id,
            txHash: result.hash,
            status: result.status,
            reference: `fund-${invoiceId}-${Date.now()}`,
          },
        });
      }
    } catch (error) {
      logger.error('Fund invoice API error', { error });
      res.status(500).json({
        error: 'Failed to fund invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async submitDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { userId, deliveryProof } = req.body; 
      const addressId = await userService.getUserWalletAddressId(userId);
      const reference = `delivery-submit-${invoiceId}-${Date.now()}`;

      const submitDeliveryAbi = [
        {
          name: 'submitDelivery',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: '_invoiceId', type: 'uint256' }],
          outputs: [],
        },
      ];

      const result = await userWalletService.writeContractFromChildAddress(addressId, {
        address: env.HOLDIS_CONTRACT_ADDRESS,
        method: 'submitDelivery',
        parameters: [invoiceId],
        abi: submitDeliveryAbi,
        reference,
        metadata: {
          userId,
          invoiceId,
          type: 'delivery_submission',
          deliveryProof,
          timestamp: new Date().toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: 'Delivery submission initiated',
        data: {
          txId: result.id,
          txHash: result.hash,
          status: result.status,
          reference,
        },
      });
    } catch (error) {
      logger.error('Submit delivery API error', { error });
      res.status(500).json({
        error: 'Failed to submit delivery',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async confirmDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { userId, confirmationNotes } = req.body; 
      const addressId = await userService.getUserWalletAddressId(userId);
      const reference = `delivery-confirm-${invoiceId}-${Date.now()}`;

      const confirmDeliveryAbi = [
        {
          name: 'confirmDelivery',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: '_invoiceId', type: 'uint256' }],
          outputs: [],
        },
      ];

      const result = await userWalletService.writeContractFromChildAddress(addressId, {
        address: env.HOLDIS_CONTRACT_ADDRESS,
        method: 'confirmDelivery',
        parameters: [invoiceId],
        abi: confirmDeliveryAbi,
        reference,
        metadata: {
          userId,
          invoiceId,
          type: 'delivery_confirmation',
          confirmationNotes,
          timestamp: new Date().toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: 'Delivery confirmation initiated',
        data: {
          txId: result.id,
          txHash: result.hash,
          status: result.status,
          reference,
        },
      });
    } catch (error) {
      logger.error('Confirm delivery API error', { error });
      res.status(500).json({
        error: 'Failed to confirm delivery',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

      
      let dbInvoice = await invoiceService.getInvoiceByOnChainId(BigInt(invoiceId));
      if (dbInvoice) {
        
        const due = dbInvoice.due_date ? new Date(dbInvoice.due_date) : null;
        if (
          (dbInvoice.status === 'pending' || dbInvoice.status === 'Pending') &&
          due &&
          due.getTime() < Date.now()
        ) {
          await invoiceService.updateInvoiceStatus({
            invoiceId: BigInt(invoiceId),
            status: 'expired',
          });
          dbInvoice = await invoiceService.getInvoiceByOnChainId(BigInt(invoiceId)) ?? dbInvoice;
        }
        res.status(200).json({
          success: true,
          data: {
            id: dbInvoice.id,
            invoice_id: dbInvoice.invoice_id,
            issuer_id: dbInvoice.issuer_id,
            amount: dbInvoice.amount,
            description: dbInvoice.description ?? '',
            customer_email: dbInvoice.customer_email ?? null,
            customer_name: dbInvoice.customer_name ?? null,
            due_date: dbInvoice.due_date ?? null,
            status: dbInvoice.status ?? 'pending',
            payment_link_id: dbInvoice.payment_link_id ?? null,
            payment_link_url: dbInvoice.payment_link_url ?? null,
            payment_link_slug: dbInvoice.payment_link_slug ?? null,
            payer_address: dbInvoice.payer_address ?? null,
            receiver_address: dbInvoice.receiver_address ?? null,
            token_address: dbInvoice.token_address ?? null,
            tx_hash: dbInvoice.tx_hash ?? null,
            created_at: dbInvoice.created_at,
            paid_at: dbInvoice.paid_at ?? null,
            updated_at: dbInvoice.updated_at ?? null,
            business_name: dbInvoice.business_name ?? null,
            business_address: dbInvoice.business_address ?? null,
            line_items: dbInvoice.line_items ?? null,
            vat_percent: dbInvoice.vat_percent ?? null,
            processing_fee_percent: dbInvoice.processing_fee_percent ?? null,
            currency: dbInvoice.currency ?? 'USD',
          },
        });
        return;
      }

      
      const invoice = await contractService.getInvoice(BigInt(invoiceId));
      if (!invoice) {
        res.status(404).json({
          error: 'Invoice not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      logger.error('Get invoice API error', { error });
      res.status(500).json({
        error: 'Failed to get invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserInvoices(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const role = (req.query.role as string) || 'all';

      
      const roleFilter = role === 'all' ? undefined : (role as 'issuer' | 'payer' | 'receiver');
      const invoices = roleFilter
        ? await invoiceService.getUserInvoices(userId, roleFilter)
        : {
            issued: await invoiceService.getUserInvoices(userId, 'issuer'),
            paying: await invoiceService.getUserInvoices(userId, 'payer'),
            receiving: await invoiceService.getUserInvoices(userId, 'receiver'),
          };

      res.status(200).json({
        success: true,
        data: invoices,
      });
    } catch (error) {
      logger.error('Get user invoices API error', { error });
      res.status(500).json({
        error: 'Failed to get invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createPaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

      
      const invoice = await contractService.getInvoice(BigInt(invoiceId));
      if (!invoice) {
        res.status(404).json({
          error: 'Invoice not found',
        });
        return;
      }

      
      const dbInvoice = await invoiceService.getInvoiceByOnChainId(BigInt(invoiceId));
      if (dbInvoice?.payment_link_url) {
        res.status(200).json({
          success: true,
          message: 'Payment link already exists',
          data: {
            paymentLink: {
              id: dbInvoice.payment_link_id,
              url: dbInvoice.payment_link_url,
              slug: dbInvoice.payment_link_slug,
            },
          },
        });
        return;
      }

      
      const amountInEth = (Number(invoice.amount) / 1e18).toFixed(4);
      
      const paymentLink = await blockradarService.createPaymentLink({
        name: `Invoice #${invoiceId} Payment`,
        description: invoice.description || `Payment for invoice #${invoiceId}`,
        amount: amountInEth,
        redirectUrl: process.env.FRONTEND_URL 
          ? `${process.env.FRONTEND_URL}/invoice/${invoiceId}/success` 
          : undefined,
        successMessage: 'Payment received! Your invoice has been funded.',
        metadata: {
          invoiceReference: invoiceId.toString(),
          invoiceId: invoiceId.toString(),
          payer: invoice.payer,
          receiver: invoice.receiver,
          requiresDelivery: invoice.requiresDelivery,
        },
        paymentLimit: 1,
      });

      logger.info('Payment link created for existing invoice', {
        invoiceId: invoiceId.toString(),
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
      });

      
      if (dbInvoice) {
        await invoiceService.updatePaymentLink(
          BigInt(invoiceId),
          paymentLink.id,
          paymentLink.url,
          paymentLink.slug
        );
      }

      res.status(201).json({
        success: true,
        message: 'Payment link created',
        data: {
          paymentLink: {
            id: paymentLink.id,
            url: paymentLink.url,
            slug: paymentLink.slug,
          },
        },
      });
    } catch (error) {
      logger.error('Create payment link API error', { error });
      res.status(500).json({
        error: 'Failed to create payment link',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

      
      const dbInvoice = await invoiceService.getInvoiceByOnChainId(BigInt(invoiceId));
      if (dbInvoice?.payment_link_id) {
        const paymentLink = await blockradarService.getPaymentLink(dbInvoice.payment_link_id);
        
        res.status(200).json({
          success: true,
          data: {
            paymentLink: {
              id: paymentLink.id,
              url: paymentLink.url,
              slug: paymentLink.slug,
              status: paymentLink.status,
              amount: paymentLink.amount,
              description: paymentLink.description,
            },
          },
        });
        return;
      }

      res.status(404).json({
        error: 'Payment link not found',
        message: 'No payment link exists for this invoice',
      });
    } catch (error) {
      logger.error('Get payment link API error', { error });
      res.status(500).json({
        error: 'Failed to get payment link',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const invoiceController = new InvoiceController();
