import { zeroAddress } from 'viem';
import { env } from '../config/env';

export const NATIVE_TOKEN_ADDRESS = zeroAddress;

export const SETTLEMENT_CHAIN_SLUG = env.CHAIN_SLUG;
export const SETTLEMENT_TOKEN_ADDRESS = env.SETTLEMENT_TOKEN_ADDRESS;
export const SETTLEMENT_TOKEN_DECIMALS = env.SETTLEMENT_TOKEN_DECIMALS;
