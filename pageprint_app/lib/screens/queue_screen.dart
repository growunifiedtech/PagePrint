import 'dart:async';
import 'package:flutter/material.dart';
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

                    const SliverToBoxAdapter(child: SizedBox(height: 40)),
                  ],
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
