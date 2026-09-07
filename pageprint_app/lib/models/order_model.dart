class OrderModel {
  final String id;
  final String tokenNumber;
  final String shopId;
  final String shopSlug;
  final String customerPhone;
  final String customerName;
  final String fileName;
  final int fileSizeBytes;
  final String fileUrl;
  final String? publicId;
  final int pageCount;
  final String selectedPages;
  final int effectivePageCount;
  final String colorMode; // 'BW' | 'COLOR'
  final bool isDuplex;
  final String paperSize;
  final String orientation;
  final int pagesPerSheet;
  final String paperFitting;
  final int printScale;
  final int copies;
  final int totalAmountPaise;
  final String paymentStatus; // 'PENDING' | 'PAID' | 'CASH_AT_COUNTER'
  final String? paymentId;
  final String printStatus; // 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED' | 'HELD_FOR_CONFIRMATION'
  final String? targetPrinterName;
  final String? heldAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  OrderModel({
    required this.id,
    required this.tokenNumber,
    required this.shopId,
    required this.shopSlug,
    required this.customerPhone,
    required this.customerName,
    required this.fileName,
    required this.fileSizeBytes,
    required this.fileUrl,
    this.publicId,
    required this.pageCount,
    required this.selectedPages,
    required this.effectivePageCount,
    required this.colorMode,
    required this.isDuplex,
    required this.paperSize,
    required this.orientation,
    required this.pagesPerSheet,
    required this.paperFitting,
    required this.printScale,
    required this.copies,
    required this.totalAmountPaise,
    required this.paymentStatus,
    this.paymentId,
    required this.printStatus,
    this.targetPrinterName,
    this.heldAt,
    required this.createdAt,
    required this.updatedAt,
  });

  double get totalAmountRupees => totalAmountPaise / 100.0;
  bool get isColor => colorMode.toUpperCase() == 'COLOR';
  bool get isPaid => paymentStatus.toUpperCase() == 'PAID';
  bool get isUpiPending => paymentStatus.toUpperCase() == 'PENDING';
  bool get isCashAtCounter => paymentStatus.toUpperCase() == 'CASH_AT_COUNTER';
  bool get isHeldOutage => printStatus.toUpperCase() == 'HELD_FOR_CONFIRMATION';

  factory OrderModel.fromMap(String id, Map<String, dynamic> map) {
    DateTime parseDate(dynamic value) {
      if (value == null) return DateTime.now();
      if (value is String) {
        return DateTime.tryParse(value) ?? DateTime.now();
      }
      try {
        return value.toDate(); // Firestore Timestamp
      } catch (_) {
        return DateTime.now();
      }
    }

    return OrderModel(
      id: id,
      tokenNumber: (map['tokenNumber'] ?? 'A-100').toString(),
      shopId: (map['shopId'] ?? '').toString(),
      shopSlug: (map['shopSlug'] ?? '').toString(),
      customerPhone: (map['customerPhone'] ?? '').toString(),
      customerName: (map['customerName'] ?? 'Customer').toString(),
      fileName: (map['fileName'] ?? 'Document.pdf').toString(),
      fileSizeBytes: (map['fileSizeBytes'] as num?)?.toInt() ?? 0,
      fileUrl: (map['fileUrl'] ?? '').toString(),
      publicId: map['publicId']?.toString(),
      pageCount: (map['pageCount'] as num?)?.toInt() ?? 1,
      selectedPages: (map['selectedPages'] ?? 'ALL').toString(),
      effectivePageCount: (map['effectivePageCount'] as num?)?.toInt() ?? 1,
      colorMode: (map['colorMode'] ?? 'BW').toString(),
      isDuplex: map['isDuplex'] == true,
      paperSize: (map['paperSize'] ?? 'A4').toString(),
      orientation: (map['orientation'] ?? 'PORTRAIT').toString(),
      pagesPerSheet: (map['pagesPerSheet'] as num?)?.toInt() ?? 1,
      paperFitting: (map['paperFitting'] ?? 'FIT').toString(),
      printScale: (map['printScale'] as num?)?.toInt() ?? 100,
      copies: (map['copies'] as num?)?.toInt() ?? 1,
      totalAmountPaise: (map['totalAmountPaise'] as num?)?.toInt() ?? 0,
      paymentStatus: (map['paymentStatus'] ?? 'PENDING').toString(),
      paymentId: map['paymentId']?.toString(),
      printStatus: (map['printStatus'] ?? 'QUEUED').toString(),
      targetPrinterName: map['targetPrinterName']?.toString(),
      heldAt: map['heldAt']?.toString(),
      createdAt: parseDate(map['createdAt']),
      updatedAt: parseDate(map['updatedAt']),
    );
  }
}
