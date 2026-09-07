import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/order_model.dart';
import '../models/shop_model.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Fetch shop by ownerId (Firebase Auth UID)
  Future<ShopModel?> getShopForUser(String uid) async {
    try {
      // 1. Check where ownerId == uid
      final query = await _db
          .collection('shops')
          .where('ownerId', isEqualTo: uid)
          .limit(1)
          .get();

      if (query.docs.isNotEmpty) {
        final doc = query.docs.first;
        return ShopModel.fromMap(doc.id, doc.data());
      }

      // 2. Fallback: check if doc ID itself is the uid
      final docDirect = await _db.collection('shops').doc(uid).get();
      if (docDirect.exists && docDirect.data() != null) {
        return ShopModel.fromMap(docDirect.id, docDirect.data()!);
      }

      return null;
    } catch (e) {
      // ignore: avoid_print
      print('Error fetching shop: $e');
      return null;
    }
  }

  /// Realtime stream for the current shop details (e.g. activePrinters, autoPrintOnUpi)
  Stream<ShopModel?> streamShop(String shopId) {
    return _db.collection('shops').doc(shopId).snapshots().map((doc) {
      if (!doc.exists || doc.data() == null) return null;
      return ShopModel.fromMap(doc.id, doc.data()!);
    });
  }

  /// Realtime stream of orders for the shop
  Stream<List<OrderModel>> streamShopOrders(String shopId) {
    return _db
        .collection('orders')
        .where('shopId', isEqualTo: shopId)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs.map((doc) {
        return OrderModel.fromMap(doc.id, doc.data());
      }).toList();

      // Sort newest first in memory so no Firestore composite index is needed
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  /// Shopkeeper verifies UPI or Cash payment and triggers immediate printing
  Future<void> acceptAndPrintOrder({
    required String orderId,
  }) async {
    await _db.collection('orders').doc(orderId).update({
      'printStatus': 'PRINTING',
      'paymentStatus': 'PAID',
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  /// Resume print after an outage hold (customer is still at counter)
  Future<void> resumePrint(String orderId) async {
    await _db.collection('orders').doc(orderId).update({
      'printStatus': 'PRINTING',
      'heldAt': FieldValue.delete(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  /// Mark printing as completed / ready for pickup
  Future<void> markOrderDone(String orderId) async {
    await _db.collection('orders').doc(orderId).update({
      'printStatus': 'PRINTED',
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  /// Reject or cancel an order, deleting it from queue
  Future<void> deleteOrder(String orderId) async {
    await _db.collection('orders').doc(orderId).delete();
  }

  /// Toggle auto-print on UPI setting
  Future<void> toggleAutoPrint(String shopId, bool enabled) async {
    await _db.collection('shops').doc(shopId).update({
      'autoPrintOnUpi': enabled,
    });
  }
}
