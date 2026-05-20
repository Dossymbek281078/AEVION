export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-gray-200">
      <h1 className="text-3xl font-bold text-white mb-2">Refund Policy</h1>
      <p className="text-gray-400 text-sm mb-10">Last updated: May 19, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">1. Free Trial</h2>
          <p>All paid plans include a 14-day free trial. You will not be charged during the trial period. You may cancel at any time before the trial ends without any charge.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">2. Refund Eligibility</h2>
          <p>We offer a full refund within <strong className="text-white">30 days</strong> of your first payment if you are not satisfied with the Service. To request a refund, contact us at <a href="mailto:billing@aevion.app" className="text-blue-400 hover:underline">billing@aevion.app</a> with your account email and reason.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">3. Subscription Cancellation</h2>
          <p>You may cancel your subscription at any time through your account settings or by contacting support. Cancellation takes effect at the end of the current billing period — you retain access until then. No partial refunds are issued for unused time after the 30-day window.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">4. Annual Plans</h2>
          <p>Annual subscriptions are eligible for a full refund within 30 days of purchase. After 30 days, annual plans are non-refundable but may be cancelled to prevent renewal.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">5. Non-Refundable Items</h2>
          <p>One-time purchases (course access, marketplace items) are non-refundable once the digital content has been accessed or downloaded, except where required by applicable law.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">6. How Refunds Are Processed</h2>
          <p>Refunds are processed through Paddle (our payment processor) and typically appear on your statement within 5–10 business days, depending on your bank.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">7. Contact</h2>
          <p>For refund requests or questions: <a href="mailto:billing@aevion.app" className="text-blue-400 hover:underline">billing@aevion.app</a></p>
        </div>
      </section>
    </div>
  );
}
