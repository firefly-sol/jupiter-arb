require('dotenv').config();
import {Connection, Keypair, PublicKey} from '@solana/web3.js';
import fetch from 'isomorphic-fetch';
import bs58 from 'bs58';
import {Jupiter, RouteInfo, TOKEN_LIST_URL} from '@jup-ag/core';

const RPC_ENDPOINT = 'https://solana-api.projectserum.com';

// Interface
interface Token {
  chainId: number; // 101,
  address: string; // '8f9s1sUmzUbVZMoMh6bufMueYH1u4BJSM57RCEvuVmFp',
  symbol: string; // 'TRUE',
  name: string; // 'TrueSight',
  decimals: number; // 9,
  logoURI: string; // 'https://i.ibb.co/pKTWrwP/true.jpg',
  tags: string[]; // [ 'utility-token', 'capital-token' ]
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const secretKey = process.env.SECRET_KEY!;
const decodedSecretKey = bs58.decode(secretKey);
const kp = Keypair.fromSecretKey(decodedSecretKey);

const getRoutes = async ({
  jupiter,
  inputToken,
  outputToken,
  inputAmount,
  slippage,
}: {
  jupiter: Jupiter;
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: number;
  slippage: number;
}) => {
  try {
    if (!inputToken || !outputToken) {
      return null;
    }

    console.log(
      `Getting routes for ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}...`,
    );
    const inputAmountInSmallestUnits = inputToken
      ? Math.round(inputAmount * 10 ** inputToken.decimals)
      : 0;
    const routes =
      inputToken && outputToken
        ? await jupiter.computeRoutes({
            inputMint: new PublicKey(inputToken.address),
            outputMint: new PublicKey(outputToken.address),
            inputAmount: inputAmountInSmallestUnits, // raw input amount of tokens
            slippage,
            forceFetch: true,
          })
        : null;

    if (routes && routes.routesInfos) {
      console.log('Possible number of routes:', routes.routesInfos.length);
      console.log(
        'Best quote: ',
        routes.routesInfos[0].outAmount / 10 ** outputToken.decimals,
        `(${outputToken.symbol})`,
      );
      return routes;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

const executeSwap = async ({
  jupiter,
  routeInfo,
}: {
  jupiter: Jupiter;
  routeInfo: RouteInfo;
}) => {
  try {
    // Prepare execute exchange
    const {execute} = await jupiter.exchange({
      routeInfo,
    });

    // Execute swap
    const swapResult: any = await execute(); // Force any to ignore TS misidentifying SwapResult type

    if (swapResult.error) {
      console.log(swapResult.error);
    } else {
      console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);
      console.log(
        `inputAddress=${swapResult.inputAddress.toString()} outputAddress=${swapResult.outputAddress.toString()}`,
      );
      console.log(
        `inputAmount=${swapResult.inputAmount} outputAmount=${swapResult.outputAmount}`,
      );
    }
  } catch (error) {
    throw error;
  }
};
async function getBestRouteToSelf(
  amount: number,
  token: Token,
  jupiter: Jupiter,
) {
  const routes = await getRoutes({
    jupiter,
    inputToken: token, // input token
    outputToken: token, // output token
    inputAmount: amount, // 1 unit in UI
    slippage: 1, // 1% slippage
  });
  return routes?.routesInfos[0];
}

async function tryToExecuteSwap(
  amount: number,
  token: Token,
  jupiter: Jupiter,
) {
  const bestRoute = await getBestRouteToSelf(amount, token, jupiter);

  const bestOutAmountWithSlippage = bestRoute?.outAmountWithSlippage ?? 0;
  const inputUSDCWithDecimals = amount * 10 ** 6;
  console.log('bestRoute', bestRoute);
  if (bestOutAmountWithSlippage > inputUSDCWithDecimals) {
    await executeSwap({jupiter, routeInfo: bestRoute!});
  }
}

const main = async () => {
  const connection = new Connection(RPC_ENDPOINT); // Setup Solana RPC connection
  const tokens: Token[] = await (
    await fetch(TOKEN_LIST_URL['mainnet-beta'])
  ).json();

  //  Load Jupiter
  const jupiter = await Jupiter.load({
    connection,
    cluster: 'mainnet-beta',
    user: kp, // or public key
  });

  const usdcToken = tokens.find((t) => t.address === USDC_MINT)!;
  const amount = 1000; // arbitrary small amount

  console.log('running');
  for (let i = 0; i < 1000; ++i) {
    tryToExecuteSwap(amount, usdcToken, jupiter);
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Timed in miliseconds so this is ten seconds
  }
};

main();
