class PrinterDeviceModel {
  final String id;
  final String name;
  final String? driverName;
  final bool isOnline;
  final bool supportsColor;
  final bool supportsDuplex;
  final String status;

  PrinterDeviceModel({
    required this.id,
    required this.name,
    this.driverName,
    required this.isOnline,
    required this.supportsColor,
    required this.supportsDuplex,
    required this.status,
  });

  factory PrinterDeviceModel.fromMap(Map<String, dynamic> map) {
    return PrinterDeviceModel(
      id: (map['id'] ?? '').toString(),
      name: (map['name'] ?? 'Printer').toString(),
      driverName: map['driverName']?.toString(),
      isOnline: map['isOnline'] == true,
      supportsColor: map['supportsColor'] == true,
      supportsDuplex: map['supportsDuplex'] == true,
      status: (map['status'] ?? 'IDLE').toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      if (driverName != null) 'driverName': driverName,
      'isOnline': isOnline,
      'supportsColor': supportsColor,
      'supportsDuplex': supportsDuplex,
      'status': status,
    };
  }
}

class ShopModel {
  final String id;
  final String name;
  final String slug;
  final String ownerName;
  final String? ownerId;
  final String? email;
  final String phone;
  final String upiId;
  final String address;
  final bool autoPrintOnUpi;
  final List<PrinterDeviceModel> activePrinters;
  final DateTime createdAt;

  ShopModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.ownerName,
    this.ownerId,
    this.email,
    required this.phone,
    required this.upiId,
    required this.address,
    required this.autoPrintOnUpi,
    required this.activePrinters,
    required this.createdAt,
  });

  int get onlinePrintersCount =>
      activePrinters.where((p) => p.isOnline).length;

  factory ShopModel.fromMap(String id, Map<String, dynamic> map) {
    DateTime parseDate(dynamic value) {
      if (value == null) return DateTime.now();
      if (value is String) {
        return DateTime.tryParse(value) ?? DateTime.now();
      }
      try {
        return value.toDate();
      } catch (_) {
        return DateTime.now();
      }
    }

    final rawPrinters = map['activePrinters'];
    List<PrinterDeviceModel> printers = [];
    if (rawPrinters is List) {
      for (final item in rawPrinters) {
        if (item is Map) {
          printers.add(
            PrinterDeviceModel.fromMap(Map<String, dynamic>.from(item)),
          );
        }
      }
    }

    return ShopModel(
      id: id,
      name: (map['name'] ?? 'Print Shop').toString(),
      slug: (map['slug'] ?? 'shop').toString(),
      ownerName: (map['ownerName'] ?? '').toString(),
      ownerId: map['ownerId']?.toString(),
      email: map['email']?.toString(),
      phone: (map['phone'] ?? '').toString(),
      upiId: (map['upiId'] ?? '').toString(),
      address: (map['address'] ?? '').toString(),
      autoPrintOnUpi: map['autoPrintOnUpi'] != false,
      activePrinters: printers,
      createdAt: parseDate(map['createdAt']),
    );
  }
}
