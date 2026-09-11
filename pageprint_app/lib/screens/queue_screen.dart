import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/order_model.dart';
import '../models/shop_model.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../services/firestore_service.dart';
import '../widgets/order_card.dart';
import 'settings_sheet.dart';

class QueueScreen extends StatefulWidget {
  final User user;
  final AuthService authService;
  final FirestoreService firestoreService;

  const QueueScreen({
    super.key,
    required this.user,
    required this.authService,
    required this.firestoreService,
  });

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  ShopModel? _initialShop;
  bool _isLoadingShop = true;
  String _selectedFilter = 'ALL'; // 'ALL', 'QUEUED', 'PRINTING', 'PRINTED', 'HELD'
  int _prevOrderCount = 0;
  Timer? _outageCheckTimer;

  @override
  void initState() {
    super.initState();
    _loadShop();

    // Outage auto-expiry timer (every 20 seconds)
    _outageCheckTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      // Auto-cleanup hook if needed
    });
  }

  @override
  void dispose() {
    _outageCheckTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadShop() async {
    final shop = await widget.firestoreService.getShopForUser(widget.user.uid);
    if (mounted) {
      setState(() {
        _initialShop = shop;
        _isLoadingShop = false;
      });
    }
  }

  void _showSettings(ShopModel currentShop) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SettingsSheet(
        shop: currentShop,
        authService: widget.authService,
        firestoreService: widget.firestoreService,
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open $url')),
        );
      }
    }
  }

  void _showWalkInSheet(BuildContext context, ShopModel currentShop) {
    final shopUrl = 'https://www.pageprint.in/shop/${currentShop.slug}';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.only(top: 16, left: 20, right: 20, bottom: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4F46E5).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.add_to_photos_rounded,
                    color: Color(0xFF4F46E5),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '+ Walk-in / Manual Upload',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Upload files or share counter link with customer',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Option 1: Open Portal
            InkWell(
              onTap: () {
                Navigator.pop(ctx);
                _openUrl(shopUrl);
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.cloud_upload_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Open Upload Portal',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Upload PDF / Photos from phone or WhatsApp',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Option 2: Show QR Code
            InkWell(
              onTap: () {
                Navigator.pop(ctx);
                _showQrDialog(context, currentShop, shopUrl);
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0E7FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.qr_code_2_rounded, color: Color(0xFF4F46E5), size: 22),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Show Counter QR Code',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            'Customer can scan directly from your phone screen',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Option 3: WhatsApp
            InkWell(
              onTap: () {
                Navigator.pop(ctx);
                final whatsappUrl =
                    'https://api.whatsapp.com/send?text=${Uri.encodeComponent('Hello! Please upload your documents for printing at ${currentShop.name}:\n$shopUrl')}';
                _openUrl(whatsappUrl);
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF16A34A), size: 22),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Share via WhatsApp',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: Color(0xFF14532D),
                            ),
                          ),
                          Text(
                            'Send upload link directly to customer WhatsApp',
                            style: TextStyle(color: Color(0xFF16A34A), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Color(0xFF16A34A)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Option 4: Copy Link
            InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: shopUrl));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Copied: $shopUrl'),
                    backgroundColor: const Color(0xFF10B981),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.copy_rounded, color: Color(0xFF475569), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Copy Shop Link',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          Text(
                            shopUrl,
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQrDialog(BuildContext context, ShopModel currentShop, String shopUrl) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              currentShop.name,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              'Scan to upload documents',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${Uri.encodeComponent(shopUrl)}',
                width: 220,
                height: 220,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return const SizedBox(
                    width: 220,
                    height: 220,
                    child: Center(child: CircularProgressIndicator(color: Color(0xFF4F46E5))),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Text(
              shopUrl,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Color(0xFF4F46E5),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingShop) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFF4F46E5)),
              SizedBox(height: 16),
              Text(
                'Connecting to Live Queue...',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_initialShop == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.storefront_outlined,
                      size: 40,
                      color: Colors.amber.shade700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Print Shop Found',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No shop profile is associated with ${widget.user.email}. Please register your shop first on the web portal.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: () => widget.authService.signOut(),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Log Out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // Stream live shop updates
    return StreamBuilder<ShopModel?>(
      stream: widget.firestoreService.streamShop(_initialShop!.id),
      initialData: _initialShop,
      builder: (context, shopSnapshot) {
        final currentShop = shopSnapshot.data ?? _initialShop!;

        // Stream live orders
        return StreamBuilder<List<OrderModel>>(
          stream: widget.firestoreService.streamShopOrders(currentShop.id),
          builder: (context, ordersSnapshot) {
            final orders = ordersSnapshot.data ?? [];

            // Soundbox Chime Trigger when new order arrives
            if (orders.length > _prevOrderCount && _prevOrderCount > 0) {
              AudioService.instance.playNewOrderChime();
            }
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _prevOrderCount != orders.length) {
                setState(() => _prevOrderCount = orders.length);
              }
            });

            // Filter logic
            final filteredOrders = orders.where((o) {
              if (_selectedFilter == 'ALL') return true;
              if (_selectedFilter == 'HELD') {
                return o.printStatus == 'HELD_FOR_CONFIRMATION';
              }
              return o.printStatus == _selectedFilter;
            }).toList();

            // Computed Metrics
            final totalRevenue = orders
                .where((o) => o.paymentStatus == 'PAID')
                .fold<double>(0.0, (sum, o) => sum + o.totalAmountRupees);
            final totalPages = orders.fold<int>(
              0,
              (sum, o) => sum + (o.effectivePageCount * o.copies),
            );
            final pendingOrders = orders
                .where((o) => o.printStatus == 'QUEUED' || o.printStatus == 'PRINTING')
                .length;

            return Scaffold(
              backgroundColor: const Color(0xFFF8FAFC),
              appBar: AppBar(
                leadingWidth: 52,
                leading: Padding(
                  padding: const EdgeInsets.only(left: 16, top: 10, bottom: 10),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      'assets/images/logo.png',
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.print_rounded,
                        color: Color(0xFF4F46E5),
                      ),
                    ),
                  ),
                ),
                titleSpacing: 12,
                title: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            currentShop.name,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: currentShop.onlinePrintersCount > 0
                                ? const Color(0xFFECFDF5)
                                : const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: currentShop.onlinePrintersCount > 0
                                      ? const Color(0xFF059669)
                                      : const Color(0xFFD97706),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                currentShop.onlinePrintersCount > 0
                                    ? '${currentShop.onlinePrintersCount} Online'
                                    : 'Agent Offline',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: currentShop.onlinePrintersCount > 0
                                      ? const Color(0xFF047857)
                                      : const Color(0xFFB45309),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    Text(
                      'pageprint.in/shop/${currentShop.slug}',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade500,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                actions: [
                  // Walk-in / Manual Upload Button
                  IconButton(
                    icon: const Icon(
                      Icons.add_to_photos_rounded,
                      color: Color(0xFF4F46E5),
                      size: 20,
                    ),
                    tooltip: '+ Walk-in / Manual Upload',
                    onPressed: () => _showWalkInSheet(context, currentShop),
                  ),

                  // Test Chime button
                  IconButton(
                    icon: Icon(
                      AudioService.instance.isMuted
                          ? Icons.volume_off_rounded
                          : Icons.volume_up_rounded,
                      color: const Color(0xFF4F46E5),
                      size: 20,
                    ),
                    tooltip: 'Test Soundbox Alert',
                    onPressed: () {
                      AudioService.instance.playNewOrderChime();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('🔔 Soundbox Chime Played!'),
                          duration: Duration(milliseconds: 900),
                        ),
                      );
                    },
                  ),

                  // Settings / Shop Profile
                  IconButton(
                    icon: const Icon(
                      Icons.settings_outlined,
                      color: Color(0xFF334155),
                      size: 20,
                    ),
                    onPressed: () => _showSettings(currentShop),
                  ),
                  const SizedBox(width: 4),
                ],
              ),
              body: RefreshIndicator(
                color: const Color(0xFF4F46E5),
                onRefresh: () async {
                  await _loadShop();
                },
                child: CustomScrollView(
                  slivers: [
                    // Metrics Grid Bar
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            // Metric 1: Pending Orders
                            Expanded(
                              child: _buildMetricCard(
                                title: 'PENDING',
                                value: '$pendingOrders',
                                subtitle: 'Ready to print',
                                isHighlight: pendingOrders > 0,
                                highlightColor: Colors.amber.shade700,
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Metric 2: Revenue
                            Expanded(
                              child: _buildMetricCard(
                                title: 'TODAY',
                                value: '₹${totalRevenue.toStringAsFixed(0)}',
                                subtitle: 'Total collected',
                                isHighlight: false,
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Metric 3: Total Pages
                            Expanded(
                              child: _buildMetricCard(
                                title: 'PAGES',
                                value: '$totalPages',
                                subtitle: 'Sheets printed',
                                isHighlight: false,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Walk-in / Manual Upload Quick Banner
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        child: InkWell(
                          onTap: () => _showWalkInSheet(context, currentShop),
                          borderRadius: BorderRadius.circular(16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF4F46E5), Color(0xFF4338CA)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF4F46E5).withValues(alpha: 0.25),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.add_to_photos_rounded,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '+ Walk-in / Manual Upload',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        'Upload files or share counter QR with customer',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Open ↗',
                                    style: TextStyle(
                                      color: Color(0xFF4F46E5),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Filter Tabs Header
                    SliverToBoxAdapter(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        child: Row(
                          children: [
                            _buildFilterChip('ALL', 'All (${orders.length})'),
                            const SizedBox(width: 6),
                            _buildFilterChip(
                              'QUEUED',
                              'Queued (${orders.where((o) => o.printStatus == 'QUEUED').length})',
                            ),
                            const SizedBox(width: 6),
                            _buildFilterChip(
                              'PRINTING',
                              'Printing (${orders.where((o) => o.printStatus == 'PRINTING').length})',
                            ),
                            const SizedBox(width: 6),
                            _buildFilterChip(
                              'PRINTED',
                              'Done (${orders.where((o) => o.printStatus == 'PRINTED').length})',
                            ),
                            const SizedBox(width: 6),
                            _buildFilterChip(
                              'HELD',
                              'Outage Holds (${orders.where((o) => o.printStatus == 'HELD_FOR_CONFIRMATION').length})',
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SliverToBoxAdapter(child: SizedBox(height: 8)),

                    // Orders List
                    if (filteredOrders.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(18),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFEEF2FF),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.print_outlined,
                                  size: 40,
                                  color: Color(0xFF4F46E5),
                                ),
                              ),
                              const SizedBox(height: 14),
                              const Text(
                                'No print jobs in this tab',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Customer orders sent to ${currentShop.slug} appear live here.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final order = filteredOrders[index];
                            return OrderCard(
                              key: ValueKey(order.id),
                              order: order,
                              firestoreService: widget.firestoreService,
                            );
                          },
                          childCount: filteredOrders.length,
                        ),
                      ),

                    const SliverToBoxAdapter(child: SizedBox(height: 80)),
                  ],
                ),
              ),
              floatingActionButton: FloatingActionButton.extended(
                onPressed: () => _showWalkInSheet(context, currentShop),
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                elevation: 4,
                icon: const Icon(Icons.add_to_photos_rounded, size: 20),
                label: const Text(
                  '+ Walk-in / Manual Upload',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required bool isHighlight,
    Color? highlightColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isHighlight
              ? (highlightColor ?? Colors.amber).withValues(alpha: 0.4)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              color: isHighlight
                  ? (highlightColor ?? Colors.amber.shade800)
                  : const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: isHighlight
                  ? (highlightColor ?? Colors.amber.shade900)
                  : const Color(0xFF0F172A),
            ),
          ),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 10,
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String filterKey, String label) {
    final isSelected = _selectedFilter == filterKey;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedFilter = filterKey);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4F46E5) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF4F46E5)
                : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}
