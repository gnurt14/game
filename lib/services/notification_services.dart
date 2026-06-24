import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../main.dart';
import '../coin/shop_screen.dart';
import '../auth/account_screen.dart';
import '../multiplayer/screens/multiplayer_hub_screen.dart';
import '../home/game_entry.dart';
import '../gift/random_gift_screen.dart';

class NotificationServices {
  NotificationServices._();
  static final NotificationServices instance = NotificationServices._();

  factory NotificationServices() => instance;

  final FirebaseMessaging messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin localNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  Future init() async {
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);

    await localNotificationsPlugin.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        if (response.payload != null) {
          try {
            final Map<String, dynamic> data = jsonDecode(response.payload!);
            _handleNotificationRouting(data);
          } catch (e) {
            print('Error parsing local notification payload: $e');
          }
        }
      },
    );

    String? token = await messaging.getToken();

    print('[FCM_Token]---: $token');

    // foreground
    FirebaseMessaging.onMessage.listen(
      (RemoteMessage message) {
        print('[Messaging]-------------onMessage: ${message.messageId}');
        showNotification(message);
      },
    );

    FirebaseMessaging.onMessageOpenedApp.listen(
      (RemoteMessage message) {
        print('[Messaging]-------------onClickNoti');
        _handleNotificationRouting(message.data);
      },
    );

    // App opened from terminated state via notification
    final RemoteMessage? initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      Future.delayed(const Duration(milliseconds: 500), () {
        _handleNotificationRouting(initialMessage.data);
      });
    }
  }

  Future<void> showNotification(RemoteMessage message) async {
    const androidDetails = AndroidNotificationDetails(
        'channel1', 'notification',
        importance: Importance.max, priority: Priority.high);

    const detail = NotificationDetails(android: androidDetails);

    await localNotificationsPlugin.show(
      id: 0,
      title: message.notification?.title,
      body: message.notification?.body,
      notificationDetails: detail,
      payload: jsonEncode(message.data),
    );
  }

  void _handleNotificationRouting(Map<String, dynamic> data) {
    print('[NotificationServices] Routing payload: $data');
    final screen = data['screen'];
    if (screen == null) return;

    final context = navigatorKey.currentContext;
    if (context == null) return;

    if (screen == 'shop') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ShopScreen()),
      );
    } else if (screen == 'multiplayer') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const MultiplayerHubScreen()),
      );
    } else if (screen == 'account') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AccountScreen()),
      );
    } else if (screen == 'random_gift') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const RandomGiftScreen()),
      );
    } else if (screen == 'game') {
      final gameName = data['gameName'];
      if (gameName != null) {
        try {
          final gameEntry = kAllGames.firstWhere(
            (g) => g.name.toLowerCase() == gameName.toString().toLowerCase(),
          );
          if (gameEntry.builder != null) {
            Navigator.push(
              context,
              MaterialPageRoute(builder: gameEntry.builder!),
            );
          }
        } catch (e) {
          print('Game not found or builder is null: $gameName');
        }
      }
    }
  }
}

Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();

  print('[Background Message]----------------');

  print('[Background Message]- ${message.data.toString()}');
}
