import 'package:flutter/material.dart';
import '../models/shop_model.dart';
import '../services/auth_service.dart';
import '../services/audio_service.dart';
import '../services/firestore_service.dart';

class SettingsSheet extends StatefulWidget {
  final ShopModel shop;
  final AuthService authService;
  final FirestoreService firestoreService;

  const SettingsSheet({
    super.key,
    required this.shop,
    required this.authService,
    required this.firestoreService,
  });

  @override
  State<SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends State<SettingsSheet> {
  late bool _autoPrint;
  late bool _isMuted;

  @override
  void initState() {
    super.initState();
    _autoPrint = widget.shop.autoPrintOnUpi;
    _isMuted = AudioService.instance.isMuted;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 30,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
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

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  color: Color(0xFF4F46E5),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.shop.name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      'pageprint.in/shop/${widget.shop.slug}',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),
          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 16),

          // Quick Controls: Auto-Print on UPI
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Auto-Print on UPI',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Text(
              'Instantly send job to Windows Spooler upon UPI payment',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            value: _autoPrint,
            activeTrackColor: const Color(0xFF4F46E5),
            onChanged: (val) {
              setState(() => _autoPrint = val);
              widget.firestoreService.toggleAutoPrint(widget.shop.id, val);
            },
          ),

          // Soundbox Chime Alert Toggle
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Soundbox Audio Chime',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Text(
              'Play alert chime on phone when customer submits new order',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            value: !_isMuted,
            activeTrackColor: const Color(0xFF059669),
            onChanged: (val) {
              setState(() {
                _isMuted = !val;
                AudioService.instance.isMuted = _isMuted;
              });
              if (val) {
                AudioService.instance.playNewOrderChime();
              }
            },
          ),

          const SizedBox(height: 12),

          // Connected Hardware Printers
          const Text(
            'CONNECTED WINDOWS PRINTERS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 8),

          if (widget.shop.activePrinters.isEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.print_disabled_rounded,
                      color: Colors.amber.shade800, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No printers synced yet. Open PagePrint.exe on your Windows PC to auto-detect.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            ...widget.shop.activePrinters.map(
              (p) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.print_rounded,
                      size: 16,
                      color: p.isOnline
                          ? const Color(0xFF059669)
                          : Colors.grey.shade400,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        p.name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: p.supportsColor
                            ? Colors.purple.shade50
                            : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        p.supportsColor ? 'Color' : 'B&W',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: p.supportsColor
                              ? Colors.purple.shade700
                              : Colors.grey.shade700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 24),

          // Logout Button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                Navigator.of(context).pop();
                await widget.authService.signOut();
              },
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Log Out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red.shade600,
                side: BorderSide(color: Colors.red.shade200),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
