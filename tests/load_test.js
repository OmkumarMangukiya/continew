import http from 'http';

const SERVER_URL = "http://localhost:3000";
const TOTAL_ENDPOINTS = 100;
const TOTAL_REQUESTS = 5000;

// 1. Spin up a local dummy server to receive the webhooks and ALWAYS return 200 OK
const dummyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: "Webhook received perfectly!" }));
});

dummyServer.listen(4000, () => {
    console.log(`🌐 Local dummy webhook receiver listening on http://localhost:4000`);
    main(); // Start the test once the dummy server is running
});

async function setupEndpoints() {
    console.log(`⏳ Creating ${TOTAL_ENDPOINTS} test endpoints pointing to our local dummy server...`);
    const endpointIds = [];
    const promises = [];

    for (let i = 0; i < TOTAL_ENDPOINTS; i++) {
        // Point to our local dummy server! It will never fail or rate-limit.
        const payload = {
            url: `http://localhost:4000/receive/${i}`
        };

        const req = fetch(`${SERVER_URL}/endpoints`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.endpoint && data.endpoint.id) {
                    endpointIds.push(data.endpoint.id);
                }
            })
            .catch(err => console.error(`Failed to create endpoint ${i}:`, err));

        promises.push(req);
    }

    // Wait for all 300 endpoint creation requests to finish
    await Promise.all(promises);
    console.log(`✅ Successfully created ${endpointIds.length} endpoints!`);
    return endpointIds;
}

async function runLoadTest(endpointIds) {
    console.log(`🚀 Starting load test... blasting ${TOTAL_REQUESTS} requests across ${endpointIds.length} endpoints!`);

    const BATCH_SIZE = 500; // Keep concurrent connections under limit to avoid ETIMEDOUT

    for (let i = 0; i < TOTAL_REQUESTS; i += BATCH_SIZE) {
        const promises = [];
        const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_REQUESTS - i);

        for (let j = 0; j < currentBatchSize; j++) {
            const requestNumber = i + j + 1;
            const randomEndpointId = endpointIds[Math.floor(Math.random() * endpointIds.length)];

            const eventBody = {
                endpointId: randomEndpointId,
                type: "load.test.event",
                payload: {
                    testNumber: requestNumber,
                    message: "This will definitely succeed!",
                    timestamp: Date.now()
                }
            };

            // Fire the fetch request without awaiting it individually
            const req = fetch(`${SERVER_URL}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventBody)
            })
                .then(res => {
                    if (!res.ok) console.error(`Request ${requestNumber} failed with status ${res.status}`);
                })
                .catch(err => console.error(`Request ${requestNumber} network error:`, err.message));

            promises.push(req);
        }

        // Wait for the current batch of 500 to finish before starting the next
        await Promise.all(promises);
        console.log(`✔️  Batch finished. Sent ${i + currentBatchSize} / ${TOTAL_REQUESTS} requests...`);
    }

    console.log(`✅ All ${TOTAL_REQUESTS} requests have been successfully sent to the queue!`);
    console.log(`👀 Switch over to your Live Dashboard at http://localhost:3000 to watch the green 200 OKs roll in.`);
    console.log(`(Press Ctrl+C in this terminal when you are done to stop the dummy server)`);
}

async function main() {
    const ids = await setupEndpoints();
    if (ids.length > 0) {
        await runLoadTest(ids);
    } else {
        console.error("No endpoints were created. Aborting load test.");
        process.exit(1);
    }
}
