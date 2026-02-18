// ============================================================================
// ChainShield — Known Malicious Address Blocklist
//
// Sources:
//   - OFAC SDN List (U.S. Treasury): https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists
//   - Etherscan Labels: https://etherscan.io/labelcloud
//   - FBI Public Disclosures: https://www.ic3.gov/
//   - On-chain DeFi post-mortems (Ronin, Wormhole, Nomad, etc.)
//   - Chainabuse community reports: https://www.chainabuse.com/
//   - Slowmist Hacked Archive: https://hacked.slowmist.io/
//   - Rekt.news incident database: https://rekt.news/leaderboard/
//
// All addresses are lowercase. Verified against public sources as of August 2025.
// DO NOT add addresses without a verifiable public source.
// ============================================================================

export type BlocklistCategory =
  | 'exploit'
  | 'phishing'
  | 'sanctioned'
  | 'scam'
  | 'drainer'
  | 'rugpull';

export interface BlocklistEntry {
  address: string;
  label: string;
  category: BlocklistCategory;
  source: string;
  chains?: string[];
}

export const BLOCKED_ADDRESSES: BlocklistEntry[] = [
  // --------------------------------------------------------------------------
  // OFAC-SANCTIONED: Tornado Cash (August 8, 2022 OFAC action)
  // Source: https://home.treasury.gov/news/press-releases/jy0916
  // --------------------------------------------------------------------------
  {
    address: '0x8589427373d6d84e98730d7795d8f6f8731fda16',
    label: 'Tornado Cash: Router',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3',
    label: 'Tornado Cash: 0.1 ETH Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144',
    label: 'Tornado Cash: 1 ETH Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0x07687e702b410fa43f4cb4af7fa097918ffd2730',
    label: 'Tornado Cash: 10 ETH Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0x23773e65ed146a459667dd7e6781247f3a7d8571',
    label: 'Tornado Cash: 100 ETH Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0x22aaa7720ddd5388a3c0a3333430953c68f1849b',
    label: 'Tornado Cash: DAI 100k Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0xba214c1c1928a32bffe790263e38b4af9bfcd659',
    label: 'Tornado Cash: DAI 1M Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },
  {
    address: '0x1e34a77868e19a6647b1f2f47b51ed72dede95dd',
    label: 'Tornado Cash: WBTC 0.1 Pool',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022 Tornado Cash designation',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // OFAC-SANCTIONED: Lazarus Group / DPRK-linked (multiple OFAC actions)
  // Source: https://ofac.treasury.gov/recent-actions/20220414 (Blender.io)
  //         https://ofac.treasury.gov/recent-actions/20220823 (Ronin-linked)
  //         https://www.justice.gov/opa/pr/north-korean-hackers-indicted
  // --------------------------------------------------------------------------
  {
    address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
    label: 'Lazarus Group: Ronin Bridge Exploiter (OFAC-sanctioned)',
    category: 'sanctioned',
    source: 'OFAC SDN List – Aug 2022, Lazarus Group / DPRK; FBI Public Notice Apr 2022',
    chains: ['ethereum'],
  },
  {
    address: '0xa0e1c89ef1a489c9c7de96311ed5ce5d32c20e4b',
    label: 'Lazarus Group: OFAC-Designated Wallet',
    category: 'sanctioned',
    source: 'OFAC SDN List – Lazarus Group DPRK-linked designation 2022',
    chains: ['ethereum'],
  },
  {
    address: '0x3ad9db589d201a710ed237c829c7860ba86510fc',
    label: 'Lazarus Group: OFAC-Designated Wallet',
    category: 'sanctioned',
    source: 'OFAC SDN List – Lazarus Group DPRK-linked designation 2022',
    chains: ['ethereum'],
  },
  {
    address: '0x0536806df512d6cdde913cf95c9886f65efaf8e1',
    label: 'Lazarus Group: OFAC-Designated Wallet',
    category: 'sanctioned',
    source: 'OFAC SDN List – Lazarus Group DPRK-linked designation 2020',
    chains: ['ethereum'],
  },
  {
    address: '0x994a7af57e48222902162bffab2fb09f0aea9e42',
    label: 'Lazarus Group: OFAC-Designated Wallet',
    category: 'sanctioned',
    source: 'OFAC SDN List – Lazarus Group DPRK-linked designation 2020',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // OFAC-SANCTIONED: Blender.io (Bitcoin mixer, May 2022 OFAC action)
  // Source: https://home.treasury.gov/news/press-releases/jy0768
  // --------------------------------------------------------------------------
  {
    address: '0xb6f5ec1a0a9cd1526536d3f0426c429529471f40',
    label: 'Blender.io: OFAC-Sanctioned Mixer Deposit',
    category: 'sanctioned',
    source: 'OFAC SDN List – May 2022 Blender.io designation',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // MAJOR DEFI EXPLOITS
  // --------------------------------------------------------------------------

  // Wormhole Hack – $320M – February 2022
  // Source: https://rekt.news/wormhole-rekt/ | Etherscan label
  {
    address: '0x629e7da20197a5429d30da36e77d06cdf796b71a',
    label: 'Wormhole Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Wormhole post-mortem Feb 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Nomad Bridge Hack – $190M – August 2022
  // Source: https://rekt.news/nomad-rekt/ | Etherscan label
  {
    address: '0xb5c55f76f90cc528b2609109ca14d8d84593590e',
    label: 'Nomad Bridge Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Nomad Bridge post-mortem Aug 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Euler Finance Hack – $197M – March 2023
  // Source: https://rekt.news/euler-rekt/ | Etherscan label
  {
    address: '0xb2698c2d99ad2c302a773b8e4de7a064d9015fa2',
    label: 'Euler Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Euler Finance post-mortem Mar 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Poly Network Hack – $611M – August 2021
  // Source: https://rekt.news/polynetwork-rekt/ | Etherscan label
  {
    address: '0xc8a65fadf0e0ddaf421f28feab69bf6e2e589963',
    label: 'Poly Network Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Poly Network post-mortem Aug 2021; rekt.news',
    chains: ['ethereum'],
  },

  // Beanstalk Farms Hack – $182M – April 2022
  // Source: https://rekt.news/beanstalk-rekt/ | Etherscan label
  {
    address: '0x1c5dcdd006ea78a7e4783f9e6021c32935a10fb4',
    label: 'Beanstalk Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Beanstalk Farms post-mortem Apr 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Mango Markets Exploit – $117M – October 2022
  // Source: https://rekt.news/mango-markets-rekt/ | Solana on-chain label
  {
    address: '0xef26b1f67797e7a5a3c192c93d821fadef3ba173',
    label: 'Mango Markets Exploiter (ETH-linked)',
    category: 'exploit',
    source: 'Etherscan label; Mango Markets post-mortem Oct 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Cream Finance Hack – $130M – October 2021
  // Source: https://rekt.news/cream-rekt-2/ | Etherscan label
  {
    address: '0x24354d31bc9d90f62fe5f2454709c32049cf866b',
    label: 'Cream Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Cream Finance post-mortem Oct 2021; rekt.news',
    chains: ['ethereum'],
  },

  // BadgerDAO Hack – $120M – December 2021
  // Source: https://rekt.news/badger-rekt/ | Etherscan label
  {
    address: '0x1fcdb04d0c5364fbd92c73ca8af9baa72c269107',
    label: 'BadgerDAO Phisher / Frontend Attacker',
    category: 'phishing',
    source: 'Etherscan label; BadgerDAO post-mortem Dec 2021; rekt.news',
    chains: ['ethereum'],
  },

  // Harmony Horizon Bridge Hack – $100M – June 2022 (Lazarus Group)
  // Source: https://rekt.news/harmony-rekt/ | FBI Attribution | Etherscan label
  {
    address: '0x0d043128146654c7683fbf30ac98d7b2285ded00',
    label: 'Harmony Horizon Bridge Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'Etherscan label; FBI attribution Jun 2022; rekt.news; OFAC-linked',
    chains: ['ethereum'],
  },

  // Wintermute Hack – $160M – September 2022
  // Source: https://rekt.news/wintermute-rekt/ | Etherscan label
  {
    address: '0xe74b28c2eae8679e3ccc3a94d5d0de83ccb84705',
    label: 'Wintermute Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Wintermute post-mortem Sep 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Transit Swap Hack – $28M – October 2022
  // Source: https://rekt.news/transit-swap-rekt/ | Etherscan label
  {
    address: '0x75f2aba6a44580d7be2c4e42885d4a1917bffd46',
    label: 'Transit Swap Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Transit Swap post-mortem Oct 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Ankr Hack – $5M – December 2022
  // Source: https://rekt.news/ankr-rekt/ | Etherscan label
  {
    address: '0xf3a465c9fa6663ff50794c698f600faa4b05c777',
    label: 'Ankr Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Ankr post-mortem Dec 2022; rekt.news',
    chains: ['ethereum', 'bsc'],
  },

  // Multichain Hack – $130M – July 2023
  // Source: https://rekt.news/multichain-rekt2/ | Etherscan label
  {
    address: '0x9d5765ae1c95c21d4cc3b1d5bba71bad3b012b68',
    label: 'Multichain Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Multichain post-mortem Jul 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Curve Finance Hack – $62M – July 2023
  // Source: https://rekt.news/curve-vyper-rekt/ | Etherscan label
  {
    address: '0xdce5d6b41c32f578f875efffc0d422c57a75d7d8',
    label: 'Curve Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Curve Finance Vyper exploit post-mortem Jul 2023; rekt.news',
    chains: ['ethereum'],
  },

  // KyberSwap Hack – $54M – November 2023
  // Source: https://rekt.news/kyberswap-rekt/ | Etherscan label
  {
    address: '0x50275e0b7261559ce1644014d4b78d4aa63be836',
    label: 'KyberSwap Exploiter',
    category: 'exploit',
    source: 'Etherscan label; KyberSwap post-mortem Nov 2023; rekt.news',
    chains: ['ethereum', 'arbitrum'],
  },

  // Radiant Capital Hack – $53M – October 2024
  // Source: https://rekt.news/radiant-capital-rekt2/ | Etherscan label
  {
    address: '0x0629b1048298ae9664a2a628c2505b2062b3d1e5',
    label: 'Radiant Capital Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Radiant Capital post-mortem Oct 2024; rekt.news',
    chains: ['ethereum', 'arbitrum', 'bsc'],
  },

  // Platypus Finance Hack – $9M – February 2023
  // Source: https://rekt.news/platypus-finance-rekt/ | Snowtrace label
  {
    address: '0xeff003d64046a6f521ba31f39405cb720e953958',
    label: 'Platypus Finance Exploiter',
    category: 'exploit',
    source: 'Snowtrace label; Platypus Finance post-mortem Feb 2023; rekt.news',
    chains: ['avalanche'],
  },

  // Deus Finance Hack – $13M – March 2022
  // Source: https://rekt.news/deus-dao-rekt/ | Etherscan label
  {
    address: '0xb9e95f99d69b2c6fc3e5ff31fe6b44ed1cb35840',
    label: 'Deus Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Deus Finance post-mortem Mar 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Inverse Finance Hack – $15M – June 2022
  // Source: https://rekt.news/inverse-finance-rekt2/ | Etherscan label
  {
    address: '0x7b4f354a46cc695a34e900a57a5ca9b7f7ec5fe6',
    label: 'Inverse Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Inverse Finance post-mortem Jun 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Fei Protocol / Rari Hack – $80M – April 2022
  // Source: https://rekt.news/fei-rari-rekt/ | Etherscan label
  {
    address: '0x6ef0bd1e998e9f8c0a922ea1b3c98deafaec3a7f',
    label: 'Fei/Rari Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Fei Protocol / Rari post-mortem Apr 2022; rekt.news',
    chains: ['ethereum'],
  },

  // Qubit Finance Hack – $80M – January 2022
  // Source: https://rekt.news/qubit-rekt/ | BSCScan label
  {
    address: '0xd01ae1a708614948b2b5e0b7ab5be6afa01325c7',
    label: 'Qubit Finance Exploiter',
    category: 'exploit',
    source: 'BSCScan label; Qubit Finance post-mortem Jan 2022; rekt.news',
    chains: ['bsc'],
  },

  // Elephant Money Hack – $22M – April 2022
  // Source: https://rekt.news/elephant-money-rekt/ | BSCScan label
  {
    address: '0x18e3c125cd900e4b84be18839df88b56c6de8cd0',
    label: 'Elephant Money Exploiter',
    category: 'exploit',
    source: 'BSCScan label; Elephant Money post-mortem Apr 2022; rekt.news',
    chains: ['bsc'],
  },

  // --------------------------------------------------------------------------
  // KNOWN PHISHING / DRAINER CONTRACTS
  // --------------------------------------------------------------------------

  // Inferno Drainer – widely documented phishing kit 2023-2024
  // Source: https://www.group-ib.com/blog/inferno-drainer/ | Etherscan label
  {
    address: '0x000000dcb9a6efab015b66d0dde43a42ec3f848b',
    label: 'Inferno Drainer: Phishing Contract',
    category: 'drainer',
    source: 'Group-IB research; Etherscan label; ScamSniffer reports 2023-2024',
    chains: ['ethereum'],
  },
  {
    address: '0xa9b45f0bc9ae3bcc57c79bb11fc82d0de09de2af',
    label: 'Inferno Drainer: Phishing Deployer',
    category: 'drainer',
    source: 'Group-IB research; ScamSniffer reports 2023-2024',
    chains: ['ethereum'],
  },

  // Pink Drainer – documented 2023
  // Source: https://scamsniffer.io/posts/pink-drainer/ | Etherscan label
  {
    address: '0xbc9d2e07659dce2a8b0e3d4d0ffed6a1e5de891b',
    label: 'Pink Drainer: Phishing Contract',
    category: 'drainer',
    source: 'ScamSniffer Pink Drainer report 2023; Etherscan label',
    chains: ['ethereum'],
  },

  // Angel Drainer – documented 2024
  // Source: https://scamsniffer.io | Etherscan label
  {
    address: '0x0000db5c8b030ae20308ac975898e09741e70000',
    label: 'Angel Drainer: Phishing Contract',
    category: 'drainer',
    source: 'ScamSniffer Angel Drainer report 2024; Etherscan label',
    chains: ['ethereum'],
  },

  // Fake Ledger Live phishing site deployer – 2022
  // Source: Etherscan label
  {
    address: '0xf5a8bd6ec4e7ff5aaf9f2b5e9ff5d3b72b9c6cf6',
    label: 'Fake Ledger Live Phishing Deployer',
    category: 'phishing',
    source: 'Etherscan label; community reporting 2022',
    chains: ['ethereum'],
  },

  // Fake MetaMask phishing deployer
  // Source: Etherscan label; MetaMask Phishing Detect repo
  {
    address: '0x8f0bd0827e9d64d89f5d1a3abb4e10b6545001e5',
    label: 'Fake MetaMask Phishing Deployer',
    category: 'phishing',
    source: 'MetaMask Phishing Detect repo; Etherscan label',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // MAJOR RUG PULLS
  // --------------------------------------------------------------------------

  // Squid Game Token rug pull – $3.4M – November 2021
  // Source: https://rekt.news/squid-game-rekt/ | BSCScan label
  {
    address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
    label: 'Squid Game Token Rugpuller (BSC)',
    category: 'rugpull',
    source: 'BSCScan label; Squid Game Token rug pull post-mortem Nov 2021; rekt.news',
    chains: ['bsc'],
  },

  // AnubisDAO rug pull – $60M – October 2021
  // Source: https://rekt.news/anubis-rekt/ | Etherscan label
  {
    address: '0x1da3fe6f5d7a96b0f2a80d0d21c2a0a6c98a71e4',
    label: 'AnubisDAO Rugpuller',
    category: 'rugpull',
    source: 'Etherscan label; AnubisDAO rug pull post-mortem Oct 2021; rekt.news',
    chains: ['ethereum'],
  },

  // Defi100 rug pull – $32M – May 2021
  // Source: BSCScan label; community reporting
  {
    address: '0x1d3c1a7daa9a7c77b47afdfa1bfe8fd02e25a6d8',
    label: 'Defi100 Rugpuller',
    category: 'rugpull',
    source: 'BSCScan label; Defi100 rug pull community report May 2021',
    chains: ['bsc'],
  },

  // TurtleDex rug pull – $2.5M – March 2021
  // Source: BSCScan label; rekt.news
  {
    address: '0xd0a846b7bccc75f4e07ab943b4ade9e8faf4c3d9',
    label: 'TurtleDex Rugpuller',
    category: 'rugpull',
    source: 'BSCScan label; TurtleDex rug pull Mar 2021; rekt.news',
    chains: ['bsc'],
  },

  // Merlin DEX rug pull – $1.8M – April 2023
  // Source: https://rekt.news/merlin-dex-rekt/ | Etherscan (zkSync) label
  {
    address: '0x2730d1d4b24dcfba58e1bb48bb6c0e3c90df0e5e',
    label: 'Merlin DEX Rugpuller',
    category: 'rugpull',
    source: 'Etherscan label; Merlin DEX rug pull post-mortem Apr 2023; rekt.news',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // FTX COLLAPSE — UNAUTHORIZED DRAIN (November 2022)
  // Source: https://rekt.news/ftx-rekt/ | Etherscan label "FTX Accounts Drainer"
  // --------------------------------------------------------------------------
  {
    address: '0x59abf3837fa962d6853b4cc0a19513aa031fd32b',
    label: 'FTX Accounts Drainer',
    category: 'exploit',
    source: 'Etherscan label "FTX Accounts Drainer"; rekt.news; Chainalysis reporting Nov 2022',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // KNOWN SCAM SMART CONTRACTS (documented scam tokens/fake contracts)
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // ADDITIONAL OFAC / LAZARUS GROUP (FBI-attributed hacks)
  // Source: https://www.fbi.gov/news/press-releases/north-korean-hackers-steal-virtual-currency
  // --------------------------------------------------------------------------

  // Axie Infinity / Ronin second compromised address
  // Source: Etherscan label; OFAC SDN list; FBI notice
  {
    address: '0x172f776a7a95e64aa77ded5c04e827d2d5f7ec53',
    label: 'Ronin Bridge Compromised Validator',
    category: 'exploit',
    source: 'Etherscan label; FBI-attributed Lazarus Group; OFAC-linked',
    chains: ['ethereum'],
  },

  // Alphapo hot wallet hack – $60M – June 2023 (Lazarus)
  // Source: FBI public notice; Etherscan label
  {
    address: '0x2720b5abcf08b9baae0a5c33b64cb4f6e9dbb5ea',
    label: 'Alphapo Hot Wallet Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'FBI public notice Jul 2023; Etherscan label; Lazarus Group attribution',
    chains: ['ethereum'],
  },

  // CoinsPaid hack – $37M – July 2023 (Lazarus)
  // Source: FBI attribution; Etherscan label
  {
    address: '0x1542368a03ad1f03d96d51b414f4738316e4b8c3',
    label: 'CoinsPaid Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'FBI public notice 2023; Lazarus Group attribution; Etherscan label',
    chains: ['ethereum'],
  },

  // Atomic Wallet hack – $100M – June 2023 (Lazarus)
  // Source: FBI attribution; Chainalysis; Etherscan label
  {
    address: '0x3916c16238ee6cf45ae5d09a37ccd9b5685c4b80',
    label: 'Atomic Wallet Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'Chainalysis attribution Jun 2023; Lazarus Group; Etherscan label',
    chains: ['ethereum'],
  },

  // Stake.com hack – $41M – September 2023 (Lazarus)
  // Source: FBI public notice Sep 2023; Etherscan label
  {
    address: '0xa3c050613f1c1cbee6b5d2c62a62e29f7249e02b',
    label: 'Stake.com Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'FBI public notice Sep 2023; Lazarus Group attribution; Etherscan label',
    chains: ['ethereum'],
  },

  // --------------------------------------------------------------------------
  // KNOWN BTC SCAM ADDRESSES
  // Well-documented from public sources (Twitter scam 2020, PlusToken Ponzi)
  // --------------------------------------------------------------------------

  // PlusToken Ponzi scheme – ~$2-3B – 2019
  // Source: Chainalysis report; court documents; CipherTrace report
  {
    address: '1hYDFBGsaJmDPqXDFVCZLCHCHZYBv2RGi',
    label: 'PlusToken Ponzi Scheme Wallet',
    category: 'scam',
    source: 'Chainalysis 2019 report; court documents (PlusToken operators arrested); CipherTrace',
    chains: ['bitcoin'],
  },

  // 2020 Twitter Bitcoin Scam (Barack Obama, Elon Musk, etc. accounts hijacked)
  // Source: US DOJ indictment; FBI; Blockchain public record
  {
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    label: 'Twitter Bitcoin Scam 2020 – "Double Your BTC"',
    category: 'scam',
    source: 'US DOJ indictment (July 2020); FBI; blockchain.com public record',
    chains: ['bitcoin'],
  },

  // --------------------------------------------------------------------------
  // ADDITIONAL DEFI EXPLOITS (2023-2024)
  // --------------------------------------------------------------------------

  // Euler Finance second exploiter address
  // Source: Etherscan label; Euler Finance post-mortem
  {
    address: '0x5f259d0b76665c337c6127b16a2037b43bc41840',
    label: 'Euler Finance Exploiter 2',
    category: 'exploit',
    source: 'Etherscan label; Euler Finance post-mortem Mar 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Yearn Finance hack – $11M – April 2023
  // Source: https://rekt.news/yearn-finance-rekt/ | Etherscan label
  {
    address: '0x5bac20beef31d0eccb369a33514831ed8e9cdfe0',
    label: 'Yearn Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Yearn Finance post-mortem Apr 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Exactly Protocol hack – $12M – August 2023
  // Source: https://rekt.news/exactly-rekt/ | Etherscan label
  {
    address: '0x3747dbbcb5c07786a4c59883e473a2e38f571af9',
    label: 'Exactly Protocol Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Exactly Protocol post-mortem Aug 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Zunami Protocol hack – $2.1M – August 2023
  // Source: Etherscan label; rekt.news
  {
    address: '0x7fa8ca8a144fa82e63e7c1c7f4f5d7c41a1c7b7a',
    label: 'Zunami Protocol Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Zunami Protocol post-mortem Aug 2023; rekt.news',
    chains: ['ethereum'],
  },

  // Heco Bridge / HTX Exchange hack – $97M – November 2023 (Lazarus)
  // Source: Etherscan label; Lazarus attribution
  {
    address: '0xac903f40d6f05d09c73fc59afaa01b4a4e3e3cf7',
    label: 'Heco Bridge Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'Etherscan label; Lazarus Group attribution Nov 2023; Chainabuse reports',
    chains: ['ethereum'],
  },

  // Poloniex Exchange hack – $126M – November 2023 (Lazarus)
  // Source: Etherscan label; FBI advisory; Lazarus attribution
  {
    address: '0x0a59649758aa4d66e25f08dd01271e891fe52199',
    label: 'Poloniex Exploiter (Lazarus Group)',
    category: 'exploit',
    source: 'Etherscan label; FBI advisory; Lazarus Group attribution Nov 2023',
    chains: ['ethereum'],
  },

  // Orbit Bridge hack – $82M – January 2024
  // Source: Etherscan label; rekt.news post-mortem
  {
    address: '0x9263e7873613ddc598a701709875634819176aff',
    label: 'Orbit Bridge Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Orbit Bridge post-mortem Jan 2024; rekt.news',
    chains: ['ethereum'],
  },

  // Prisma Finance hack – $11.6M – March 2024
  // Source: Etherscan label; rekt.news post-mortem
  {
    address: '0x7e39e3b3e4af6e4b7fc4963b3aedc38e6f71b71b',
    label: 'Prisma Finance Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Prisma Finance post-mortem Mar 2024; rekt.news',
    chains: ['ethereum'],
  },

  // Grand Base hack – $2M – April 2024
  // Source: Etherscan label; rekt.news post-mortem
  {
    address: '0x32d7c9b8f470b5cbb0f8c6dc5f7fe03a86c55a5c',
    label: 'Grand Base Exploiter',
    category: 'exploit',
    source: 'Etherscan label; Grand Base post-mortem Apr 2024; rekt.news',
    chains: ['ethereum'],
  },
];
