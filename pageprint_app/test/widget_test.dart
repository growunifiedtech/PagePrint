import 'package:flutter_test/flutter_test.dart';
import 'package:pageprint_app/models/order_model.dart';
import 'package:pageprint_app/models/shop_model.dart';

void main() {
  test('OrderModel instantiation and calculations', () {
    final order = OrderModel(
      id: 'ord-123',
      tokenNumber: 'A-101',
      shopId: 'shop-test',
      shopSlug: 'apex-xerox',
      customerPhone: '9876543210',
      customerName: 'Rahul Sharma',
      fileName: 'Resume.pdf',
      fileSizeBytes: 102400,
      fileUrl: 'https://example.com/Resume.pdf',
      pageCount: 3,
      selectedPages: 'ALL',
      effectivePageCount: 3,
      colorMode: 'BW',
      isDuplex: true,
      paperSize: 'A4',
      orientation: 'PORTRAIT',
      pagesPerSheet: 1,
      paperFitting: 'FIT',
      printScale: 100,
      copies: 2,
      totalAmountPaise: 1200,
      paymentStatus: 'PAID',
      printStatus: 'QUEUED',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    expect(order.tokenNumber, 'A-101');
    expect(order.totalAmountRupees, 12.0);
    expect(order.isPaid, true);
    expect(order.isColor, false);
    expect(order.isHeldOutage, false);
  });

  test('ShopModel instantiation and active printers calculation', () {
    final shop = ShopModel(
      id: 'shop-test',
      name: 'Apex Prints',
      slug: 'apex-prints',
      ownerName: 'Sunil Verma',
      phone: '9876500000',
      upiId: 'sunil@upi',
      address: 'Main Market, Delhi',
      autoPrintOnUpi: true,
      activePrinters: [
        PrinterDeviceModel(
          id: 'p-1',
          name: 'Canon MF3010',
          isOnline: true,
          supportsColor: false,
          supportsDuplex: false,
          status: 'IDLE',
        ),
      ],
      createdAt: DateTime.now(),
    );

    expect(shop.onlinePrintersCount, 1);
    expect(shop.activePrinters.first.name, 'Canon MF3010');
  });
}
