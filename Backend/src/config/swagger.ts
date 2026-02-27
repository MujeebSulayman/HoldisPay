import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'holDIs API',
      version: '1.0.0',
      description: 'Blockchain invoice and payment protocol with optional escrow',
      contact: {
        name: 'holDIs',
        url: 'https://holdis.io',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT || 3000}`,
        description: 'Development server',
      },
      {
        url: 'https://api.holdis.io',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Users',
        description: 'User management and wallet operations',
      },
      {
        name: 'Invoices',
        description: 'Invoice creation and payment operations',
      },
      {
        name: 'Webhooks',
        description: 'Blockradar webhook handlers',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            walletAddress: { type: 'string' },
            kycStatus: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
          },
        },
        UserRegistration: {
          type: 'object',
          required: ['email', 'password', 'accountType', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            accountType: { type: 'string', enum: ['individual', 'business'] },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phoneNumber: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                postalCode: { type: 'string' },
                country: { type: 'string' },
              },
            },
            businessInfo: {
              type: 'object',
              properties: {
                businessName: { type: 'string' },
                registrationNumber: { type: 'string' },
                taxId: { type: 'string' },
                businessType: { type: 'string' },
                website: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
        Wallet: {
          type: 'object',
          properties: {
            addressId: { type: 'string' },
            address: { type: 'string' },
            balance: {
              type: 'object',
              properties: {
                nativeBalance: { type: 'string' },
                tokens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      balance: { type: 'string' },
                      symbol: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            issuer: { type: 'string' },
            payer: { type: 'string' },
            receiver: { type: 'string' },
            amount: { type: 'string' },
            tokenAddress: { type: 'string' },
            status: { type: 'string', enum: ['Pending', 'Funded', 'Delivered', 'Completed', 'Cancelled'] },
            requiresDelivery: { type: 'boolean' },
            description: { type: 'string' },
            attachmentHash: { type: 'string' },
            createdAt: { type: 'string' },
            fundedAt: { type: 'string' },
            deliveredAt: { type: 'string' },
            completedAt: { type: 'string' },
          },
        },
        CreateInvoiceRequest: {
          type: 'object',
          required: ['userId', 'payer', 'receiver', 'amount'],
          properties: {
            userId: { type: 'string' },
            payer: { type: 'string' },
            receiver: { type: 'string' },
            amount: { type: 'string' },
            tokenAddress: { type: 'string' },
            requiresDelivery: { type: 'boolean' },
            description: { type: 'string' },
            attachmentHash: { type: 'string' },
          },
        },
        TransactionResponse: {
          type: 'object',
          properties: {
            txId: { type: 'string' },
            txHash: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
            reference: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
