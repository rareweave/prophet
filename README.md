# Prophet by RareWeave
Prophet is very simple implementation of SmartWeave Delegated Resolution Environment Node (https://academy.warp.cc/docs/dre/overview).

Supports bundled (but indexed) interactions/contracts.

Does NOT support contract queries yet (only telling state).

Does NOT support Warp Sequencer and EXM based contracts.

Does NOT store cache (yet), only in memory

## Installation

You need Node.js 16+

```sh
git clone https://github.com/rareweave/prophet prophet
cd prophet
```
Now open `config.json5` in convenient file editor and insert contracts codes you want to allow there, configure gateways.

Now you're ready to go! Run prophet.

```sh
yarn start
```

Now check it's working

```sh
curl http://127.0.0.1:8181/contract?id=rUZicjroUM2Bo9l3uCdHP-arXggMZJ7T_ure3k5H8Sw # your own contract id

# {"status":"evaluated","contractTxId":"rUZicjroUM2Bo9l3uCdHP-arXggMZJ7T_ure3k5H8Sw","state":{"owner":"udOL7D7qkfFyfnkxfRQA0r1Eoz1-XRwUOSLfiCFee38","minter":"udOL...

```

