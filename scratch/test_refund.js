async function testRefund() {
    const url = 'https://script.google.com/macros/s/AKfycbxzXvVjASViAK--nYwzfJ_iTbK8e7Ilfd9xjbDdzS3SdXPTgdPRVSd9M4ORimanRWZN/exec';
    const payload = {
        action: 'log_refund',
        refundDate: '28/06/2026',
        email: 'test_admin_refund@gmail.com',
        product: 'Capcut',
        purchaseDate: '01/02/2026',
        months: 12,
        amountPaid: 180000,
        usedDays: 108,
        remainingDays: 252,
        refundAmount: 126000,
        customerName: 'Admin',
        customerPhone: ''
    };

    console.log('Sending payload to:', url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await response.text();
        console.log('Response status:', response.status);
        console.log('Response body:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testRefund();
