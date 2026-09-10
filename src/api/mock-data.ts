import type { Message } from "@/types/chat"

export interface MockSession {
    session_id: string
    title: string
    updated_at: string
    messages: Message[]
}

export const MOCK_USER = {
    id: "usr_janatics_001",
    username: "muniyappan",
    name: "Muniyappan",
    email: "user@janatics.com",
    department: "ITRS Department",
    jchat_flag: "Approved",
}

const now = new Date()
const todayISO = now.toISOString()
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()

export const MOCK_SESSIONS: MockSession[] = [
    {
        session_id: "session-today-1",
        title: "Production issue - Database connection pool exhaustion",
        updated_at: todayISO,
        messages: [
            {
                id: "msg-1-1",
                sender: "user",
                text: "We are observing `TimeoutError: QueuePool limit of size 5 overflow 10 reached` on the valve telemetry service during peak factory shifts. How do we fix this?",
                timestamp: "10:15 AM",
            },
            {
                id: "msg-1-2",
                sender: "assistant",
                text: `### Diagnosis & Mitigation: Connection Pool Exhaustion

This error indicates that all connections in SQLAlchemy/HikariCP are either checked out or connection leaks are preventing them from returning to the pool.

#### Immediate Recommendations
1. **Increase Pool Capacity with Guardrails:**
\`\`\`sql
-- Verify active database connections and long-running idle transactions
SELECT pid, usename, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start ASC;
\`\`\`

2. **Configuration Updates in Service:**
\`\`\`typescript
export const dbConfig = {
  poolSize: 20,          // Base connections
  maxOverflow: 15,       // Allow temporary burst
  poolTimeout: 30,       // Max wait time before error (seconds)
  poolRecycle: 1800,     // Recycle connections older than 30 mins
};
\`\`\`

#### Metric Summary
| Metric | Previous Value | Recommended Value | Expected Impact |
| :--- | :--- | :--- | :--- |
| Pool Size | 5 | 20 | Reduces queue backpressure |
| Max Overflow | 10 | 15 | Absorbs shift start spikes |
| Pool Timeout | 10s | 30s | Prevents premature failure |

> **Next Step:** Check if any transaction is missing an explicit \`COMMIT\` or \`ROLLBACK\` in the telemetry ingestion handler.`,
                timestamp: "10:16 AM",
            },
        ],
    },
    {
        session_id: "session-today-2",
        title: "SQL query discussion - Optimize pneumatic valve telemetry",
        updated_at: todayISO,
        messages: [
            {
                id: "msg-2-1",
                sender: "user",
                text: "Can you write an optimized PostgreSQL query to find valves exceeding 85 PSI pressure over the last 15 minutes?",
                timestamp: "02:30 PM",
            },
            {
                id: "msg-2-2",
                sender: "assistant",
                text: `Here is the optimized query utilizing time-series indexing and composite filtering:

\`\`\`sql
SELECT 
    valve_id,
    station_code,
    MAX(pressure_psi) AS peak_pressure,
    ROUND(AVG(pressure_psi)::numeric, 2) AS avg_pressure,
    COUNT(*) AS alert_event_count
FROM valve_telemetry
WHERE timestamp >= NOW() - INTERVAL '15 minutes'
  AND pressure_psi > 85.0
GROUP BY valve_id, station_code
ORDER BY peak_pressure DESC;
\`\`\`

### Index Recommendation
To ensure this query executes in < 5ms:
\`\`\`sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_valve_telemetry_time_pressure 
ON valve_telemetry (timestamp DESC, pressure_psi);
\`\`\``,
                timestamp: "02:31 PM",
            },
        ],
    },
    {
        session_id: "session-yesterday-1",
        title: "Offline IoT sync architecture for factory gateways",
        updated_at: yesterday,
        messages: [
            {
                id: "msg-3-1",
                sender: "user",
                text: "How should our shopfloor edge devices buffer sensor packets when internet connectivity drops?",
                timestamp: "04:10 PM",
            },
            {
                id: "msg-3-2",
                sender: "assistant",
                text: `For shopfloor resilience in **Janatics Offline Architecture**, implement a **Store-and-Forward** mechanism using SQLite or RocksDB at the edge:

1. **Local Append-Only Buffer**: Write telemetry events to local disk immediately.
2. **Backpressure Throttling**: FIFO queue with high-priority channels for safety interlocks.
3. **Resumable Batch Upload**: Sync in chunks of 500 records once uplink heartbeats succeed.`,
                timestamp: "04:12 PM",
            },
        ],
    },
    {
        session_id: "session-older-1",
        title: "Quarterly information security compliance review",
        updated_at: fourDaysAgo,
        messages: [
            {
                id: "msg-4-1",
                sender: "user",
                text: "What are the key IT compliance requirements for internal chatbot usage under Janatics ITRS policy?",
                timestamp: "11:00 AM",
            },
            {
                id: "msg-4-2",
                sender: "assistant",
                text: `Under the **Janatics Acceptable Use Policy (AUP)**:
- Never transmit passwords, personal data (PII), or confidential CAD designs.
- All sessions are audited for compliance.
- AI answers must always be verified by an engineer prior to production execution.`,
                timestamp: "11:02 AM",
            },
        ],
    },
]

export const PROMPT_SUGGESTIONS = [
    {
        id: "screenshot",
        title: "Analyze this screenshot...",
        description: "Paste (Ctrl+V) or drop an image to analyze errors & metrics",
        prompt: "Can you analyze this system screen and identify any errors, bottlenecks, or anomalies?",
    },
    {
        id: "sql",
        title: "Explain this SQL query",
        description: "Break down performance, indexes, and execution plans",
        prompt: "Can you explain how to optimize high-throughput telemetry queries and provide indexed schema examples?",
    },
    {
        id: "troubleshoot",
        title: "Help me troubleshoot an error",
        description: "Debug logs, connection pools, or API timeouts",
        prompt: "Help me troubleshoot a server connection timeout issue on our internal API gateway.",
    },
    {
        id: "spec",
        title: "Draft a technical specification",
        description: "Write architectural guidelines for edge offline sync",
        prompt: "Draft a technical architecture specification for an offline-first industrial IoT sync gateway.",
    },
]

export function getMockAIResponse(prompt: string): string {
    const lower = prompt.toLowerCase()

    if (lower.includes("sql") || lower.includes("query") || lower.includes("database")) {
        return `### SQL Query Analysis & Recommended Solution

Here is a high-performance query structured for **time-series telemetry and relational filtering**:

\`\`\`sql
-- Query to extract telemetry metrics with running aggregation
WITH ranked_metrics AS (
    SELECT 
        device_id,
        metric_key,
        metric_value,
        recorded_at,
        ROW_NUMBER() OVER(PARTITION BY device_id, metric_key ORDER BY recorded_at DESC) AS rank
    FROM device_telemetry_logs
    WHERE recorded_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
    device_id,
    metric_key,
    metric_value,
    recorded_at
FROM ranked_metrics
WHERE rank = 1
ORDER BY recorded_at DESC;
\`\`\`

#### Key Execution Highlights:
- **Partitioning Strategy**: Window function \`ROW_NUMBER()\` partitions without expensive joins.
- **Index Usage**: Ensure a composite index on \`(device_id, metric_key, recorded_at DESC)\`.

| Index Column | Data Type | Purpose |
| :--- | :--- | :--- |
| \`device_id\` | \`UUID\` | Primary partition key |
| \`metric_key\` | \`VARCHAR(64)\` | Sensor metric filter |
| \`recorded_at\` | \`TIMESTAMPTZ\` | B-Tree range scan |

Would you like me to tailor this for a specific table schema or database engine?`
    }

    if (lower.includes("screenshot") || lower.includes("image") || lower.includes("error") || lower.includes("screen")) {
        return `### Screenshot & Error Analysis Report

I have processed the context provided. Here is the structured diagnostic breakdown:

#### 1. Identified Symptoms
- **Component**: Gateway / Service Ingestion Pipeline
- **Observation**: Increased latency spikes coinciding with batch transmission.
- **Root Cause**: Resource bottleneck in asynchronous buffer pool allocation.

#### 2. Actionable Remediation Steps
1. Verify system socket descriptors:
\`\`\`bash
# Check current open file and socket limits
ulimit -n
lsof -i :5002
\`\`\`

2. Implement exponential backoff in retry logic:
\`\`\`typescript
async function fetchWithRetry(url: string, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}
\`\`\`

Feel free to paste another screenshot or share the exact error stack trace!`
    }

    return `### Assistant Response

Thank you for your inquiry regarding **${prompt.slice(0, 40)}...**.

Here is the requested analysis and recommended execution approach:

1. **System Architecture Alignment**:
   - Ensure secure credential handling complying with **Janatics ITRS** policies.
   - Maintain offline data availability using deterministic queue storage.

2. **Implementation Example**:
\`\`\`typescript
// Implementation blueprint
export interface SystemConfig {
  serviceName: "J-CHAT";
  environment: "production" | "offline";
  offlineSyncEnabled: boolean;
}

export function initializeSystem(config: SystemConfig): void {
  console.log(\`[\${config.serviceName}] Initialized in \${config.environment} mode\`);
}
\`\`\`

3. **Validation Summary**:
| Test Phase | Verification | Status |
| :--- | :--- | :--- |
| Unit Tests | Core Business Logic | Passed |
| Integration | API Gateway Contract | Ready |
| Offline Cache | IndexedDB / Local Storage | Active |

Please let me know if you would like me to adjust or elaborate on any specific detail!`
}
