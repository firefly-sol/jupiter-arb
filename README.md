# How to build a $1.4M MEV Arbitrage Bot on Solana

MEV arbitrage has *literally* changed my life for the better. It's given me the financial freedom to pursue my dreams and relationships. I thought that it's only natural I give back to the community that has given so much to me. In the past 6 months, I have made $1.4M in MEV arbitrage profits on Solana.

> ![](https://zfdrlzkmvdolgndlgqpm.supabase.co/storage/v1/object/public/images/a3d23405-4ac8-47cd-af20-fe1a2765b1ea/d5fdb25f-4f71-4c27-8568-b7a0ad73cc5d.png)
>
> $300K MEV Arbitrage on the Solana blockchain

I'll share my source code, so be sure to read to the end.

> Few live to tell the tale --- @firefly_sol

*Note, this tutorial will assume that the reader already has fundamental knowledge of programming and typescript.*

An arbitrage is considered successful if you start with an amount of token A, and end up with more of it than you started.

We're going to be writing this bot with typescript and using [Jupiter's aggregator sdk](https://github.com/jup-ag/jupiter-core-example).

Step 1. Use Jupiter Documentation
---------------------------------

When programming something new, I like to see if there are any examples I can start out by working off of.\
In our case, we got lucky. Jupiter has published a working example of a swap.

Starting off in `index.ts`, we need to copy a few functions to understand the Jupiter SDK.\
It's important that we read all the routes for going USDC -> USDC

```javascript
const  getRoutes  =  async  ({
  jupiter,
  inputToken,
  outputToken,
  inputAmount,
  slippage,
}:  {
  jupiter: Jupiter;
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: number;
  slippage: number;
})  =>  {
try  {
  if  (!inputToken ||  !outputToken)  {
return  null;
}

console.log(
  `Getting routes for ${inputAmount}  ${inputToken.symbol} -> ${outputToken.symbol}...`,
);
const inputAmountInSmallestUnits = inputToken
  ? Math.round(inputAmount *  10  ** inputToken.decimals)
  :  0;
  const routes =
  inputToken && outputToken
  ?  await jupiter.computeRoutes({
    inputMint:  new  PublicKey(inputToken.address),
    outputMint:  new  PublicKey(outputToken.address),
    inputAmount: inputAmountInSmallestUnits,  // raw input amount of tokens
    slippage,
    forceFetch:  true,
})
:  null;

if  (routes && routes.routesInfos)  {
  console.log('Possible number of routes:', routes.routesInfos.length);
  console.log(
  'Best quote: ',
  routes.routesInfos[0].outAmount /  10  ** outputToken.decimals,
  `(${outputToken.symbol})`,
);
  return routes;
}  else  {
  return  null;
}
}  catch  (error)  {
  throw error;
}
};
```

We can reuse most of this, however we may want to remove the `console.log` statements as it can save precious milliseconds.

> MEV is the ultimate PVP game --- @firefly_sol

We obviously also need to get the [executeSwap](https://github.com/jup-ag/jupiter-core-example/blob/main/src/index.ts#L101-L131) code in our body as well, to execute any swaps we want.

Part 2: Adding a driver function
--------------------------------

The thesis of this simple bot is essentially polling jupiter for swaps from USDC to USDC, and having them do the routing for us. We only need to execute.

To do so, I created two helper functions. One will find the best route from a token to itself

```javascript
async function getBestRouteToSelf(
  amount: number,
  token:  Token,
  jupiter:  Jupiter,
)  {
const routes =  await  getRoutes({
  jupiter,
  inputToken: token,  // input token
  outputToken: token,  // output token
  inputAmount: amount,  // 1 unit in UI
  slippage:  1,  // 1% slippage
});
return routes?.routesInfos[0];
}
```

The first route in the array is the one that will give us the best quote.\
I use this function in my driver function, which I aptly named `tryToExecuteSwap`

```javascript
async  function  tryToExecuteSwap(
  amount: number,
  token: Token,
  jupiter: Jupiter,
)  {
const bestRoute =  await  getBestRouteToSelf(amount, token, jupiter);

    const bestOutAmountWithSlippage = bestRoute?.outAmountWithSlippage ??  0;
    const inputUSDCWithDecimals = amount *  10  **  6;
    console.log('bestRoute', bestRoute);
    if  (bestOutAmountWithSlippage > inputUSDCWithDecimals)  {
    await  executeSwap({jupiter,  routeInfo: bestRoute!});
  }
}
```

Something that may not be obvious to add for an MEV beginner is the if statement

```javascript
if  (bestOutAmountWithSlippage > inputUSDCWithDecimals)  {
```

The reason I add this is to safeguard my bot from making transactions that could lose money. That way *this bot can only possibly make money. Never lose.*

Part 3: Putting it all together
-------------------------------

I put this in a main function and run it with a loop

```javascript
for  (let i =  0; i <  1000;  ++i)  {\
  tryToExecuteSwap(amount, usdcToken, jupiter);
  await new Promise((resolve)  =>  setTimeout(resolve,  10000));  // Timed in miliseconds so this is ten seconds
 }
```

I wait a few seconds before every attempt, but in production, you'll want to frequently ping the chain for MEV arbitrage opportunities.

I have open sourced the source code I used in this tutorial for any dedicated newbies wanting to learn MEV arbitrage.

[Original post](https://vertical.im/@firefly_sol/how-to-build-a-14m-mev-arbitrage-bot-on--xrnEjEYm)

<https://github.com/firefly-sol/jupiter-arb/>
