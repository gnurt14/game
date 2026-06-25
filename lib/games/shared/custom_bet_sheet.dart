// custom_bet_sheet.dart — Bottom sheet cho phép user nhập số xu cược tuỳ ý
// (không bị giới hạn bởi các mệnh giá chip cố định).

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Mở bottom sheet để chọn số xu cược tuỳ chỉnh.
///
/// - [balance]: số xu hiện có của user (đặt cận trên cho input).
/// - [initial]: giá trị gợi ý sẵn trong ô input (mặc định 0).
/// - [minBet]: số xu tối thiểu (mặc định 1).
///
/// Trả về số xu đã chọn, hoặc `null` nếu user huỷ.
Future<int?> showCustomBetSheet(
  BuildContext context, {
  required int balance,
  int initial = 0,
  int minBet = 1,
}) {
  return showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _CustomBetSheet(
      balance: balance,
      initial: initial,
      minBet: minBet,
    ),
  );
}

class _CustomBetSheet extends StatefulWidget {
  const _CustomBetSheet({
    required this.balance,
    required this.initial,
    required this.minBet,
  });

  final int balance;
  final int initial;
  final int minBet;

  @override
  State<_CustomBetSheet> createState() => _CustomBetSheetState();
}

class _CustomBetSheetState extends State<_CustomBetSheet> {
  late final TextEditingController _ctrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    final init = widget.initial > 0 ? widget.initial : '';
    _ctrl = TextEditingController(text: init.toString());
    _ctrl.addListener(_validate);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  int? get _parsed {
    final t = _ctrl.text.trim();
    if (t.isEmpty) return null;
    return int.tryParse(t);
  }

  void _validate() {
    final v = _parsed;
    setState(() {
      if (v == null) {
        _error = null;
      } else if (v < widget.minBet) {
        _error = 'Tối thiểu ${widget.minBet} xu';
      } else if (v > widget.balance) {
        _error = 'Vượt quá số xu hiện có';
      } else {
        _error = null;
      }
    });
  }

  bool get _valid {
    final v = _parsed;
    return v != null && v >= widget.minBet && v <= widget.balance;
  }

  void _setAmount(int v) {
    _ctrl.text = v.toString();
    _ctrl.selection =
        TextSelection.fromPosition(TextPosition(offset: _ctrl.text.length));
  }

  void _confirm() {
    if (!_valid) return;
    Navigator.of(context).pop(_parsed);
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF15151F),
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          border: Border(
            top: BorderSide(color: Color(0xFFFFD700), width: 1.5),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Grab handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'CƯỢC TUỲ CHỈNH',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(0xFFFFD700),
                fontWeight: FontWeight.w900,
                fontSize: 18,
                letterSpacing: 2.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Số dư: 🪙 ${widget.balance}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 13),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _ctrl,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
              ),
              onSubmitted: (_) => _confirm(),
              decoration: InputDecoration(
                hintText: '0',
                hintStyle: const TextStyle(color: Colors.white24, fontSize: 32),
                suffixText: '🪙',
                suffixStyle: const TextStyle(fontSize: 22),
                errorText: _error,
                filled: true,
                fillColor: const Color(0xFF0B0B14),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFF2A2A40)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFFFD700), width: 2),
                ),
                errorBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Colors.redAccent),
                ),
                focusedErrorBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Colors.redAccent, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _quickBtn('25%', () => _setAmount((widget.balance * 0.25).floor())),
                const SizedBox(width: 8),
                _quickBtn('50%', () => _setAmount((widget.balance * 0.5).floor())),
                const SizedBox(width: 8),
                _quickBtn('75%', () => _setAmount((widget.balance * 0.75).floor())),
                const SizedBox(width: 8),
                _quickBtn('ALL-IN', () => _setAmount(widget.balance),
                    accent: true),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      backgroundColor: const Color(0xFF1E1E2C),
                    ),
                    child: const Text(
                      'HUỶ',
                      style: TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: TextButton(
                    onPressed: _valid ? _confirm : null,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      backgroundColor: _valid
                          ? const Color(0xFFFFD700)
                          : const Color(0xFF2A2A2A),
                    ),
                    child: Text(
                      'ĐẶT CƯỢC',
                      style: TextStyle(
                        color: _valid ? Colors.black : Colors.white24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickBtn(String label, VoidCallback onTap, {bool accent = false}) {
    return Expanded(
      child: GestureDetector(
        onTap: widget.balance > 0 ? onTap : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: accent
                ? const Color(0xFFB71C1C).withOpacity(0.2)
                : const Color(0xFF1E1E2C),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: accent
                  ? Colors.redAccent.withOpacity(0.6)
                  : const Color(0xFF2A2A40),
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: accent ? Colors.redAccent : Colors.white70,
              fontWeight: FontWeight.bold,
              fontSize: 12,
              letterSpacing: 1,
            ),
          ),
        ),
      ),
    );
  }
}
