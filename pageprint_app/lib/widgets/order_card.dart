import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/order_model.dart';
import '../services/firestore_service.dart';

class OrderCard extends StatelessWidget {
  final OrderModel order;
  final FirestoreService firestoreService;

  const OrderCard({
    super.key,
    required this.order,
    required this.firestoreService,
  });

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('hh:mm a').format(order.createdAt);
    final totalSheets = order.effectivePageCount * order.copies;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: order.isHeldOutage
              ? Colors.amber.shade400
              : order.printStatus == 'PRINTING'
                  ? Colors.blue.shade300
                  : const Color(0xFFE2E8F0),
          width: order.isHeldOutage || order.printStatus == 'PRINTING' ? 1.5 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Token Number, Customer Name, and Time
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Token Badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: const Color(0xFFC7D2FE),
                    ),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'TOKEN',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                      Text(
                        order.tokenNumber,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1E1B4B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Customer Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              order.customerName.isEmpty
                                  ? 'Counter Customer'
                                  : order.customerName,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(
                            Icons.phone_iphone_rounded,
                            size: 13,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            order.customerPhone.isEmpty
                                ? 'Counter'
                                : order.customerPhone,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '•  $timeStr',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade400,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Price Tag
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${order.totalAmountRupees.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    _buildPaymentChip(order),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 14),
            const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),

            // Document Details & Tags
            Row(
              children: [
                const Icon(
                  Icons.description_outlined,
                  size: 16,
                  color: Color(0xFF64748B),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    order.fileName,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF334155),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Specs Chips Row
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                // Color Mode
                _buildTag(
                  label: order.isColor ? 'Color' : 'B&W',
                  bgColor: order.isColor
                      ? const Color(0xFFFFE4E6)
                      : const Color(0xFFF1F5F9),
                  textColor: order.isColor
                      ? const Color(0xFFBE123C)
                      : const Color(0xFF334155),
                  isBold: true,
                ),

                // Duplex
                _buildTag(
                  label: order.isDuplex ? 'Duplex (Both sides)' : 'Single Sided',
                  bgColor: const Color(0xFFEFF6FF),
                  textColor: const Color(0xFF1D4ED8),
                ),

                // Paper Size
                _buildTag(
                  label: order.paperSize,
                  bgColor: const Color(0xFFEEF2FF),
                  textColor: const Color(0xFF4338CA),
                ),

                // Orientation
                _buildTag(
                  label: order.orientation == 'LANDSCAPE'
                      ? 'Landscape ↔'
                      : 'Portrait ↕',
                  bgColor: const Color(0xFFF8FAFC),
                  textColor: const Color(0xFF475569),
                ),

                // Copies & Pages
                _buildTag(
                  label:
                      '${order.effectivePageCount} pgs × ${order.copies} = $totalSheets sheets',
                  bgColor: const Color(0xFFFAF5FF),
                  textColor: const Color(0xFF7E22CE),
                  isBold: true,
                ),

                if (order.pagesPerSheet > 1)
                  _buildTag(
                    label: '${order.pagesPerSheet}-on-1 Sheet',
                    bgColor: const Color(0xFFF0FDFA),
                    textColor: const Color(0xFF0F766E),
                  ),

                if (order.selectedPages != 'ALL')
                  _buildTag(
                    label: 'Pages: ${order.selectedPages}',
                    bgColor: const Color(0xFFFFFBEB),
                    textColor: const Color(0xFFB45309),
                  ),
              ],
            ),

            // Outage Hold Banner (if power cut / internet cut occurred)
            if (order.isHeldOutage) ...[
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            size: 18, color: Colors.amber.shade900),
                        const SizedBox(width: 6),
                        Text(
                          'INTERRUPTED BY POWER/NET OUTAGE',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: Colors.amber.shade900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'If customer is still waiting at counter, tap Resume Print. If customer left, tap Cancel to save paper & ink.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF451A03),
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () =>
                                firestoreService.resumePrint(order.id),
                            icon: const Icon(Icons.play_arrow_rounded, size: 18),
                            label: const Text(
                              'Resume Print',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.amber.shade700,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _confirmDelete(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red.shade700,
                            side: BorderSide(color: Colors.red.shade200),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('Cancel Order'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 14),

            // Action Buttons
            _buildActionButtons(context),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentChip(OrderModel order) {
    String text = 'PENDING';
    Color bgColor = const Color(0xFFEEF2FF);
    Color textColor = const Color(0xFF4338CA);

    if (order.isPaid) {
      text = '✓ PAID';
      bgColor = const Color(0xFFECFDF5);
      textColor = const Color(0xFF047857);
    } else if (order.isCashAtCounter) {
      text = '💵 CASH';
      bgColor = const Color(0xFFFFFBEB);
      textColor = const Color(0xFFB45309);
    } else {
      text = '📢 UPI CHECK';
      bgColor = const Color(0xFFEEF2FF);
      textColor = const Color(0xFF4338CA);
    }

    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildTag({
    required String label,
    required Color bgColor,
    required Color textColor,
    bool isBold = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    if (order.isHeldOutage) {
      return const SizedBox.shrink();
    }

    if (order.printStatus == 'QUEUED') {
      return Row(
        children: [
          // Accept & Print Button
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => firestoreService.acceptAndPrintOrder(
                orderId: order.id,
              ),
              icon: Icon(
                order.isCashAtCounter
                    ? Icons.payments_rounded
                    : Icons.check_circle_outline_rounded,
                size: 18,
              ),
              label: Text(
                order.isCashAtCounter
                    ? 'Collect Cash & Print'
                    : 'Verify UPI & Print',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: order.isCashAtCounter
                    ? const Color(0xFF4F46E5)
                    : const Color(0xFF059669),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Reject Button
          IconButton(
            onPressed: () => _confirmDelete(context),
            tooltip: 'Reject Order',
            icon: const Icon(Icons.close_rounded),
            color: Colors.red.shade600,
            style: IconButton.styleFrom(
              backgroundColor: Colors.red.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      );
    }

    if (order.printStatus == 'PRINTING') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.blue.shade200),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Color(0xFF2563EB),
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Printing on Windows Spooler...',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E40AF),
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => firestoreService.markOrderDone(order.id),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Done ✓',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      );
    }

    if (order.printStatus == 'PRINTED') {
      return Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_rounded,
                    size: 16, color: Color(0xFF047857)),
                SizedBox(width: 6),
                Text(
                  'Printed & Ready for Pickup',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF047857),
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          IconButton(
            onPressed: () => _confirmDelete(context),
            tooltip: 'Clear from Queue',
            icon: const Icon(Icons.delete_outline_rounded, size: 18),
            color: Colors.grey.shade500,
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Reject Token #${order.tokenNumber}?'),
        content: Text(
          'Are you sure you want to reject or remove order for "${order.customerName}" (${order.fileName})? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              firestoreService.deleteOrder(order.id);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove Order'),
          ),
        ],
      ),
    );
  }
}
