import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  BlockradarResponse,
  BlockradarError,
  TransferRequest,
  TransferResponse,
  ContractReadRequest,
  ContractWriteRequest,
  ContractWriteResponse,
  BatchContractWriteResponse,
  ContractNetworkFeeRequest,
  ContractNetworkFeeResponse,
  WalletBalance,
  TransactionStatus,
  HoldFundsRequest,
  ReleaseFundsRequest,
} from '../types/blockradar';

export class BlockradarService {
  private client: AxiosInstance;
  private walletId: string;

  constructor() {
    this.walletId = env.BLOCKRADAR_WALLET_ID;
    this.client = axios.create({
      baseURL: env.BLOCKRADAR_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BLOCKRADAR_API_KEY,
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Blockradar API Request', {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('Blockradar API Request Error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Blockradar API Response', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError<BlockradarError>) => {
        const errorDetails = error.response?.data || {
          message: error.message,
          statusCode: error.response?.status || 500,
          error: 'UNKNOWN_ERROR',
        };

        logger.error('Blockradar API Error', {
          status: error.response?.status,
          error: errorDetails,
        });

        return Promise.reject(errorDetails);
      }
    );
  }

  async getWalletBalance(assetId?: string): Promise<WalletBalance> {
    try {
      const response = await this.client.get<BlockradarResponse<WalletBalance>>(
        `/v1/wallets/${this.walletId}/balance`
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get wallet balance', { error });
      throw error;
    }
  }


  async getAddressBalances(
    walletId: string,
    addressId: string,
    options?: { apiKey?: string; chainSlug?: string | string[] }
  ): Promise<{ native: string; nativeUSD: string; tokens: Array<{ address: string; symbol: string; balance: string; balanceUSD: string; logoUrl?: string }> }> {
    try {
      const headers = options?.apiKey ? { 'x-api-key': options.apiKey } : undefined;
      const response = await this.client.get<BlockradarResponse<Array<{
        asset: { asset: { address?: string; symbol?: string; decimals?: number; logoUrl?: string }; blockchain?: { symbol?: string; slug?: string; name?: string } };
        balance: string;
        convertedBalance: string;
      }>>>(
        `/v1/wallets/${walletId}/addresses/${addressId}/balances`,
        headers ? { headers } : undefined
      );
      let list = response.data?.data || [];
      if (options?.chainSlug) {
        const slugs = Array.isArray(options.chainSlug) ? options.chainSlug.map((x) => x.toLowerCase()) : [options.chainSlug.toLowerCase()];
        list = list.filter((item) => {
          const s = (item.asset?.blockchain?.slug || item.asset?.blockchain?.name || '').toLowerCase();
          return slugs.some((slug) => s === slug || s.includes(slug));
        });
      }
      const zeroAddr = '0x0000000000000000000000000000000000000000';
      let native = '0';
      let nativeUSD = '0';
      const tokens: Array<{ address: string; symbol: string; balance: string; balanceUSD: string; logoUrl?: string }> = [];
      for (const item of list) {
        const addr = (item.asset?.asset?.address || '').toLowerCase();
        const symbol = item.asset?.asset?.symbol || item.asset?.blockchain?.symbol || '?';
        const balance = item.balance || '0';
        const usd = item.convertedBalance || '0';
        const logoUrl = item.asset?.asset?.logoUrl;
        if (addr === zeroAddr || addr === '') {
          native = balance;
          nativeUSD = usd;
        } else {
          tokens.push({ address: addr, symbol, balance, balanceUSD: usd, logoUrl });
        }
      }
      return { native, nativeUSD, tokens };
    } catch (error) {
      logger.warn('Failed to get address balances', { walletId, addressId, error });
      return { native: '0', nativeUSD: '0', tokens: [] };
    }
  }


  async updateAddress(
    walletId: string,
    addressId: string,
    body: { disableAutoSweep?: boolean; enableGaslessWithdraw?: boolean; name?: string; metadata?: Record<string, unknown> },
    options?: { apiKey?: string }
  ): Promise<void> {
    const headers = options?.apiKey ? { 'x-api-key': options.apiKey } : undefined;
    await this.client.patch(
      `/v1/wallets/${walletId}/addresses/${addressId}`,
      body,
      headers ? { headers } : undefined
    );
  }

  async readContract<T = unknown>(
    request: ContractReadRequest
  ): Promise<T> {
    try {
      const response = await this.client.post<BlockradarResponse<T>>(
        `/v1/wallets/${this.walletId}/contracts/read`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to read contract', { error, request });
      throw error;
    }
  }

  async writeContract(
    request: ContractWriteRequest
  ): Promise<ContractWriteResponse | BatchContractWriteResponse> {
    try {
      const response = await this.client.post(
        `/v1/wallets/${this.walletId}/contracts/write`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to write contract', { error, request });
      throw error;
    }
  }

  async estimateNetworkFee(
    request: ContractNetworkFeeRequest
  ): Promise<ContractNetworkFeeResponse> {
    try {
      const response = await this.client.post<BlockradarResponse<ContractNetworkFeeResponse>>(
        `/v1/wallets/${this.walletId}/contracts/network-fee`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to estimate network fee', { error, request });
      throw error;
    }
  }

  async transfer(request: TransferRequest): Promise<TransferResponse> {
    try {
      const response = await this.client.post<BlockradarResponse<TransferResponse>>(
        `/v1/wallets/${this.walletId}/transfer`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to transfer', { error, request });
      throw error;
    }
  }

  async getTransactionStatus(txId: string): Promise<TransactionStatus> {
    try {
      const response = await this.client.get<BlockradarResponse<TransactionStatus>>(
        `/v1/wallets/${this.walletId}/transactions/${txId}`
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get transaction status', { error, txId });
      throw error;
    }
  }

  
  async getTransactionDetails(txId: string): Promise<{ blockchain?: { slug?: string; name?: string }; chainId?: number } | null> {
    try {
      const response = await this.client.get<BlockradarResponse<Record<string, unknown>>>(
        `/v1/wallets/${this.walletId}/transactions/${txId}`
      );
      const data = response.data?.data;
      if (!data) return null;
      const blockchain = data.blockchain as { slug?: string; name?: string } | undefined;
      const chainId = data.chainId as number | undefined;
      return { blockchain, chainId };
    } catch (error) {
      logger.warn('Failed to get transaction details for backfill', { txId, error });
      return null;
    }
  }

  async holdFunds(request: HoldFundsRequest): Promise<void> {
    try {
      logger.info('Holding funds in custody', {
        invoiceId: request.invoiceId,
        amount: request.amount,
        token: request.token,
      });

    } catch (error) {
      logger.error('Failed to hold funds', { error, request });
      throw error;
    }
  }

  async releaseFunds(request: ReleaseFundsRequest): Promise<{
    receiverTransfer: TransferResponse;
    platformFeeTransfer: TransferResponse;
  }> {
    try {
      logger.info('Releasing funds from custody', {
        invoiceId: request.invoiceId,
        toAddress: request.toAddress,
        amount: request.amount,
        platformFee: request.platformFee,
      });

      const netAmount = (
        BigInt(request.amount) - BigInt(request.platformFee)
      ).toString();

      const isNativeToken = request.token === '0x0000000000000000000000000000000000000000';
      const tokenForBalance = isNativeToken ? undefined : request.token;

      const hasSufficientBalance = await this.hasSufficientBalance(
        request.amount,
        tokenForBalance
      );

      if (!hasSufficientBalance) {
        const errorMsg = `Insufficient ${isNativeToken ? 'native' : 'token'} balance for transfer`;
        logger.error(errorMsg, {
          invoiceId: request.invoiceId,
          required: request.amount,
          token: request.token,
        });
        throw new Error(errorMsg);
      }

      const receiverTransfer = await this.transfer({
        to: request.toAddress,
        amount: netAmount,
        token: isNativeToken ? undefined : request.token,
        reference: `invoice-${request.invoiceId}-payment`,
        metadata: {
          invoiceId: request.invoiceId,
          type: 'invoice_payment',
        },
      });

      logger.info('Receiver transfer initiated', {
        invoiceId: request.invoiceId,
        txHash: receiverTransfer.hash,
        status: receiverTransfer.status,
      });

      const platformFeeTransfer = await this.transfer({
        to: env.PLATFORM_WALLET_ADDRESS,
        amount: request.platformFee,
        token: isNativeToken ? undefined : request.token,
        reference: `invoice-${request.invoiceId}-fee`,
        metadata: {
          invoiceId: request.invoiceId,
          type: 'platform_fee',
        },
      });

      logger.info('Funds released successfully', {
        invoiceId: request.invoiceId,
        receiverTx: receiverTransfer.hash,
        feeTx: platformFeeTransfer.hash,
      });

      return { receiverTransfer, platformFeeTransfer };
    } catch (error) {
      logger.error('Failed to release funds', { error, request });
      throw error;
    }
  }

  async refundFunds(
    invoiceId: string,
    payerAddress: string,
    amount: string,
    token: string
  ): Promise<TransferResponse> {
    try {
      logger.info('Refunding funds to payer', {
        invoiceId,
        payerAddress,
        amount,
      });

      const refundTransfer = await this.transfer({
        to: payerAddress,
        amount,
        token: token === '0x0000000000000000000000000000000000000000'
          ? undefined
          : token,
        reference: `invoice-${invoiceId}-refund`,
        metadata: {
          invoiceId,
          type: 'refund',
        },
      });

      logger.info('Refund completed', {
        invoiceId,
        txHash: refundTransfer.hash,
      });

      return refundTransfer;
    } catch (error) {
      logger.error('Failed to refund funds', { error, invoiceId });
      throw error;
    }
  }

  async batchReadContract<T = unknown>(
    requests: ContractReadRequest[]
  ): Promise<T[]> {
    try {
      const results = await Promise.all(
        requests.map(request => this.readContract<T>(request))
      );
      return results;
    } catch (error) {
      logger.error('Failed to batch read contract', { error });
      throw error;
    }
  }

  async hasSufficientBalance(
    amount: string,
    token?: string
  ): Promise<boolean> {
    try {
      const balance = await this.getWalletBalance();

      if (!token || token === '0x0000000000000000000000000000000000000000') {
        return BigInt(balance.nativeBalance) >= BigInt(amount);
      }

      const tokenBalance = balance.tokens.find(t =>
        t.token.toLowerCase() === token.toLowerCase()
      );

      if (!tokenBalance) {
        return false;
      }

      return BigInt(tokenBalance.balance) >= BigInt(amount);
    } catch (error) {
      logger.error('Failed to check balance', { error, amount, token });
      return false;
    }
  }

  async pollTransactionStatus(
    txId: string,
    options?: {
      maxAttempts?: number;
      intervalMs?: number;
      onUpdate?: (status: TransactionStatus) => void;
    }
  ): Promise<TransactionStatus> {
    const maxAttempts = options?.maxAttempts || 60; const intervalMs = options?.intervalMs || 2000; let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getTransactionStatus(txId);

        if (options?.onUpdate) {
          options.onUpdate(status);
        }

        if (status.status === 'SUCCESS' || status.status === 'FAILED') {
          logger.info('Transaction finalized', {
            txId,
            status: status.status,
            attempts,
          });
          return status;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      } catch (error) {
        logger.error('Error polling transaction status', { error, txId, attempts });
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error(`Transaction polling timeout after ${maxAttempts} attempts for txId: ${txId}`);
  }

  async createPaymentLink(request: any): Promise<any> {
    try {
      logger.info('Creating payment link', { request });

      
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('name', request.name);
      if (request.description) form.append('description', request.description);
      if (request.amount) form.append('amount', String(request.amount));
      if (request.redirectUrl) form.append('redirectUrl', request.redirectUrl);
      if (request.successMessage) form.append('successMessage', request.successMessage);
      if (request.metadata) form.append('metadata', JSON.stringify(request.metadata));
      if (request.paymentLimit) form.append('paymentLimit', String(request.paymentLimit));

      const response = await this.client.post<any>('/v1/payment_links', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const data = response.data?.data ?? response.data;
      logger.info('Payment link created', {
        linkId: data.id,
        url: data.url,
      });

      return data;
    } catch (error) {
      logger.error('Failed to create payment link', { error, request });
      throw error;
    }
  }

  async getPaymentLink(linkId: string): Promise<any> {
    try {
      const response = await this.client.get<any>(
        `/v1/wallets/${this.walletId}/payment-links/${linkId}`
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get payment link', { error, linkId });
      throw error;
    }
  }

  async getPaymentLinkTransactions(linkId: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<any> {
    try {
      const response = await this.client.get<any>(
        `/v1/wallets/${this.walletId}/payment-links/${linkId}/transactions`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get payment link transactions', { error, linkId });
      throw error;
    }
  }

  async getSwapQuote(request: any): Promise<any> {
    try {
      logger.info('Getting swap quote', { request });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/swaps/quote`,
        request
      );

      logger.info('Swap quote retrieved', {
        fromAsset: request.fromAssetId,
        toAsset: request.toAssetId,
        amount: response.data.data.amount,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get swap quote', { error, request });
      throw error;
    }
  }

  async executeSwap(request: any): Promise<any> {
    try {
      logger.info('Executing swap', { request });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/swaps/execute`,
        request
      );

      logger.info('Swap executed', {
        swapId: response.data.data.id,
        status: response.data.data.status,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to execute swap', { error, request });
      throw error;
    }
  }

  async withdrawToExternalWallet(request: any): Promise<any> {
    try {
      logger.info('Withdrawing to external wallet', {
        recipientAddress: request.recipientAddress,
        amount: request.amount,
      });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/transfers`,
        {
          recipientAddress: request.recipientAddress,
          amount: request.amount,
          token: request.token,
          reference: request.reference,
          metadata: request.metadata,
        }
      );

      logger.info('Withdrawal initiated', {
        transferId: response.data.data.id,
        hash: response.data.data.hash,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to withdraw', { error, request });
      throw error;
    }
  }

  async getBlockchains(): Promise<any> {
    try {
      const response = await this.client.get<any>('/v1/blockchains');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get blockchains', { error });
      throw error;
    }
  }

  async getAssets(): Promise<any> {
    try {
      const response = await this.client.get<any>('/v1/assets');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get assets', { error });
      throw error;
    }
  }

  async getWalletDetails(walletId?: string): Promise<any> {
    try {
      const id = walletId || this.walletId;
      const response = await this.client.get<BlockradarResponse<any>>(
        `/v1/wallets/${id}`
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get wallet details', { error, walletId });
      throw error;
    }
  }

  async getWalletAssets(walletId: string): Promise<any[]> {
    try {
      logger.info('Fetching assets for wallet', { walletId });
      const walletDetails = await this.getWalletDetails(walletId);
      
      logger.info('Wallet assets retrieved', { 
        walletId, 
        assetCount: walletDetails.assets?.length || 0 
      });
      
      return walletDetails.assets || [];
    } catch (error) {
      logger.error('Failed to get wallet assets', { error, walletId });
      throw error;
    }
  }


  async getWalletAssetsFromApi(walletId: string, options?: { apiKey?: string }): Promise<any[]> {
    try {
      const url = `${env.BLOCKRADAR_API_URL}/v1/wallets/${walletId}/assets`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': options?.apiKey || env.BLOCKRADAR_API_KEY,
      };
      const response = await axios.get<{ data?: any[] }>(url, { headers, timeout: 15000 });
      const raw = response.data?.data ?? [];
      if (!Array.isArray(raw)) return [];
      return raw.map((item: any) => {
        const asset = item.asset ?? item;
        const blockchain = asset.blockchain ?? {};
        return {
          id: asset.id,
          slug: asset.slug ?? asset.id,
          symbol: asset.symbol ?? '',
          name: asset.name ?? asset.symbol ?? '',
          decimals: asset.decimals ?? 18,
          logoUrl: asset.logoUrl ?? '',
          isActive: asset.isActive !== false,
          address: asset.address ?? null,
          blockchain: {
            id: blockchain.id,
            slug: (blockchain.slug ?? '').toLowerCase(),
            name: blockchain.name ?? blockchain.slug ?? '',
            symbol: blockchain.symbol ?? '',
          },
        };
      });
    } catch (error) {
      logger.error('Failed to get wallet assets from API', { error, walletId });
      throw error;
    }
  }

  async getChainAssets(chainId: string): Promise<any[]> {
    try {
      const response = await this.client.get<BlockradarResponse<any[]>>('/v1/assets');
      const allAssets = response.data.data || [];
      
      const chainAssets = allAssets.filter((asset: any) => {
        const assetChain = asset.chain?.toLowerCase();
        return assetChain === chainId.toLowerCase();
      });

      logger.info('Chain assets filtered', { 
        chainId, 
        totalAssets: allAssets.length,
        chainAssets: chainAssets.length 
      });

      return chainAssets;
    } catch (error) {
      logger.error('Failed to get chain assets', { error, chainId });
      throw error;
    }
  }

  async estimateWithdrawalFee(walletId: string, request: {
    assetId: string;
    address: string;
    amount: string;
  }): Promise<any> {
    try {
      logger.info('Estimating withdrawal fee', { walletId, request });

      const response = await this.client.post<BlockradarResponse<any>>(
        `/v1/wallets/${walletId}/withdraw/network-fee`,
        request
      );

      logger.info('Withdrawal fee estimated', {
        networkFee: response.data.data.networkFee,
        networkFeeInUSD: response.data.data.networkFeeInUSD,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to estimate withdrawal fee', { error, walletId, request });
      throw error;
    }
  }

  async withdraw(walletId: string, request: {
    assetId: string;
    address: string;
    amount: string;
    reference?: string;
    note?: string;
    metadata?: any;
  }): Promise<any> {
    try {
      logger.info('Initiating withdrawal', { walletId, request });

      const response = await this.client.post<BlockradarResponse<any>>(
        `/v1/wallets/${walletId}/withdraw`,
        request
      );

      logger.info('Withdrawal initiated', {
        withdrawalId: response.data.data.id,
        hash: response.data.data.hash,
        status: response.data.data.status,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to initiate withdrawal', { error, walletId, request });
      throw error;
    }
  }

  async getSupportedAssets(): Promise<any[]> {
    try {
      const response = await this.client.get<any>('/v1/assets');
      const allAssets = response.data.data || [];
      
      const baseAssets = allAssets.filter((asset: any) => 
        asset.chain === 'BASE' || asset.chainId === 8453 || asset.chainId === 84532
      );

      return baseAssets;
    } catch (error) {
      logger.error('Failed to get supported assets', { error });
      throw error;
    }
  }

  async transferFunds(request: {
    to: string;
    amount: string;
    asset: string;
    chain: string;
    reference?: string;
  }): Promise<TransferResponse> {
    try {
      logger.info('Transferring funds', { request });

      const isNativeToken = request.asset === '0x0000000000000000000000000000000000000000';

      const response = await this.client.post<BlockradarResponse<TransferResponse>>(
        `/v1/wallets/${this.walletId}/transfer`,
        {
          to: request.to,
          amount: request.amount,
          token: isNativeToken ? undefined : request.asset,
          reference: request.reference || `payment-${Date.now()}`,
          metadata: {
            chain: request.chain,
            type: 'contract_payment',
          },
        }
      );

      logger.info('Funds transferred', {
        to: request.to,
        amount: request.amount,
        txHash: response.data.data.hash,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to transfer funds', { error, request });
      throw error;
    }
  }
}

export const blockradarService = new BlockradarService();
