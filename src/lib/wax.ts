// WAX API endpoints
const WAX_RPC_ENDPOINTS = [
  "https://wax.greymass.com",
  "https://wax.eosphere.io",
  "https://api.wax.alohaeos.com",
];

// WaxDAO contract
export const WAXDAO_CONTRACT = "waxdaolocker";

// WAX Chain ID
const WAX_CHAIN_ID = "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4";

export type WalletType = "wax" | "anchor";

export interface WalletSession {
  type: WalletType;
  account: string;
  anchorSession?: any;
  waxInstance?: any;
}

// Lazy-loaded WAX instance
let waxInstance: any = null;
let anchorLinkInstance: any = null;

async function getWaxInstance() {
  if (!waxInstance) {
    const waxjs = await import("@waxio/waxjs/dist");
    waxInstance = new waxjs.WaxJS({
      rpcEndpoint: WAX_RPC_ENDPOINTS[0],
      tryAutoLogin: false,
    });
  }
  return waxInstance;
}

async function getAnchorLink() {
  if (!anchorLinkInstance) {
    const [AnchorLink, AnchorLinkBrowserTransport] = await Promise.all([
      import("anchor-link").then((m) => m.default),
      import("anchor-link-browser-transport").then((m) => m.default),
    ]);
    const transport = new AnchorLinkBrowserTransport();
    anchorLinkInstance = new AnchorLink({
      transport,
      chains: [
        {
          chainId: WAX_CHAIN_ID,
          nodeUrl: WAX_RPC_ENDPOINTS[0],
        },
      ],
    });
  }
  return anchorLinkInstance;
}

// Login with WAX Cloud Wallet
export async function loginWithWax(): Promise<WalletSession> {
  try {
    const wax = await getWaxInstance();
    const userAccount = await wax.login();
    return {
      type: "wax",
      account: userAccount,
      waxInstance: wax,
    };
  } catch (error) {
    console.error("WAX Cloud Wallet login failed:", error);
    throw error;
  }
}

// Login with Anchor
export async function loginWithAnchor(): Promise<WalletSession> {
  try {
    const anchorLink = await getAnchorLink();
    const identity = await anchorLink.login("cheesedaotools");
    return {
      type: "anchor",
      account: String(identity.session.auth.actor),
      anchorSession: identity.session,
    };
  } catch (error) {
    console.error("Anchor login failed:", error);
    throw error;
  }
}

// Logout
export async function logout(session: WalletSession): Promise<void> {
  if (session.type === "anchor" && session.anchorSession) {
    await session.anchorSession.remove();
  }
  // WAX Cloud Wallet doesn't have a logout method
}

// Sign and broadcast transaction
export async function transact(
  session: WalletSession,
  actions: any[]
): Promise<any> {
  if (session.type === "wax") {
    const wax = session.waxInstance || (await getWaxInstance());
    return await wax.api.transact(
      { actions },
      { blocksBehind: 3, expireSeconds: 120 }
    );
  } else if (session.type === "anchor" && session.anchorSession) {
    return await session.anchorSession.transact({ actions });
  }
  throw new Error("Invalid session");
}

// Fetch table data from WAX blockchain
export async function fetchTable<T>(
  code: string,
  scope: string,
  table: string,
  options: {
    lower_bound?: string;
    upper_bound?: string;
    limit?: number;
    key_type?: string;
    index_position?: number;
  } = {}
): Promise<T[]> {
  // Use eosphere endpoint which has better CORS support for browser requests
  const response = await fetch(`https://wax.eosphere.io/v1/chain/get_table_rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: true,
      code,
      scope,
      table,
      lower_bound: options.lower_bound || "",
      upper_bound: options.upper_bound || "",
      limit: options.limit || 100,
      key_type: options.key_type || "",
      index_position: options.index_position || 1,
    }),
  });

  const data = await response.json();
  return data.rows as T[];
}

// Get user's token balances
export async function getTokenBalances(account: string): Promise<{ symbol: string; amount: string; contract: string }[]> {
  try {
    const response = await fetch(
      `https://wax.eosphere.io/v2/state/get_tokens?account=${account}`
    );
    const data = await response.json();
    return data.tokens?.map((t: any) => ({
      symbol: t.symbol,
      amount: String(t.amount),
      contract: t.contract,
    })) || [];
  } catch (error) {
    console.error("Failed to fetch token balances:", error);
    return [];
  }
}
