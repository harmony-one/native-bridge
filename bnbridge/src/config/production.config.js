const config = {
  apiUrl: process.env.REACT_APP_API_URL + (process.env.REACT_APP_API_PORT ? (':' + process.env.REACT_APP_API_PORT) : '')
    || "https://bridge.harmony.one",
  apiToken: "ZTgwMTY1NjkzZjAyOTk1N2VjNDQ4MjBhNGRiODJiMGI1NjI5YjM2YjJkNjc1YjVhYjE0YmEwNTBhMDFiNDk3ZDpmYmM3MWMyOTRmOWE4N2VlM2QzMmVkZDVkNjExNTE4MTFlNDRmNzc0NDgzNzY4OWVmYWRkYmJiOWY3NjgxYzA5",
  bnbExplorerURL: "https://explorer.binance.org/tx/",
  hmyExplorerURL: "https://explorer.harmony.one/#/tx/",
  bnbAddressLength: 42,
  erc20addressLength: 42,
};

export default config;
