const RULES: [RegExp, string][] = [
  // Transfers/payments — exclude from spend (check first)
  [
    /\bcc billpay\b|\bcredit card payment\b|\bcard payment\b|\bbill pay\b|\bbillpay\b|\bpayment to credit card\b|\bpayment on cred\b|\bpaid on cred\b|\bvia cred\b|\bcard bill\b|\bstatement payment\b|\bauto debit\b|\bstanding instruction\b|\bach debit\b|\bmandate\b|\bemi\b|\btransfer\b|cc bill payment|nskaveti|7729945111|gokiwi|\.bdp\b|\bdtax\b|\bself\b|icici bank credit ca|funding a\/c/i,
    'Transfer',
  ],
  [/reward\s*360/i, 'Shopping'],
  [/cashback|refund/i, 'Rewards'],
  [
    /zerodh|mutual fund(s)?|mf\b|liquidbees?|goldbees?|niftybees?|sensexbees?|etf\b|demat|broking|shares?|stocks?|equity|groww|indmoney|kfintech|cams?|nsdl|cdsl|nps\b|\bsip\b|ramkrishna forgings|indigrid|national aluminium|oracle financial|bommi|trf to fd|fixed deposit|bse limite/i,
    'Investments',
  ],

  // Food & Dining
  [/swiggy|zomato|eternal limited|hardcastle|taco bell|restaurant|cafe|bakery|udupi|dine|eatery|food|coffee|telugu aromas|traditional treats/i, 'Food & Dining'],

  // Groceries
  [/blinkit|loyal world super mar|amazon pay.*grocery|grocery|grocer|supermarket|hypermart|provision store|provision stor|vegetables|mint family mart|pk hyper|brahmaanaidu|brahmanaidus|simran banu|milkbasket|bigbasket/i, 'Groceries'],

  // Shopping
  [/the souled store|amazon pay|flipkart|myntra|ajio|biba fashion|hues.?studio|home town|nykaa|nyka|dart frog/i, 'Shopping'],

  // Transport / rides
  [/\buber\b|\bola\b|\brapido\b|\bcab\b|\btaxi\b|\bmetro\b/i, 'Travel'],

  // Travel
  [/easytrip|easy trip|makemytrip|irctc|goibibo|flight|hotel|booking\.com|cleartrip|ixigo/i, 'Travel'],

  // Utilities
  [/airtel|jio\b|bsnl|vodafone|electricity|apepdcl|apspdcl|bescom|ptm.*pdcl|payatria|convergence|broadband|internet|wifi|mobile recharge|recharge/i, 'Utilities'],

  // Housing
  [/bhaskarsubrama|nobroker|rent|housing|maintenance|society|dasika/i, 'Housing'],

  // Fuel
  [/petrol|fuel|\bhp\b|bharat petroleum|indian oil|service station/i, 'Fuel'],

  // Health & Medical
  [/iciciprudent|iciciprulife|iciciprulif|pharmacy|medical|hospital|clinic|apollo|diagnostic|\blab\b/i, 'Health'],

  // Education
  [/udemy|coursera|byju|unacademy|school|college|tuition|course|class|utib0000844|prepladder|integr/i, 'Education'],

  // Entertainment
  [/netflix|spotify|prime video|hotstar|zee5|subscription/i, 'Entertainment'],

  // Government / Passport
  [/passport|seva|government|govt/i, 'Government'],

  // UPI catch-all — must be last so all specific categories above take precedence
  [/^upi\//i, 'UPI'],
]

export function categorize(description: string): string {
  for (const [pattern, category] of RULES) {
    if (pattern.test(description)) return category
  }
  return 'Other'
}
