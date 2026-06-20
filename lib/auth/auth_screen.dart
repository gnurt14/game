// auth_screen.dart — Màn hình đăng nhập / đăng ký
//
// Dark theme nhất quán với game hub
// Toggle giữa Login và Register không cần navigation

import 'package:flutter/material.dart';
import 'package:game/auth/player_model.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'auth_service.dart';
import '../coin/coin_service.dart';
import '../coin/weekly_mission_service.dart';
import '../coin/achievement_service.dart';
import '../onboarding/onboarding_service.dart';

class AuthScreen extends StatefulWidget {
  final VoidCallback onAuthenticated;
  const AuthScreen({super.key, required this.onAuthenticated});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  // ── Mode ──────────────────────────────────────────────────────────────────
  bool _isLogin = true;

  // ── Controllers ───────────────────────────────────────────────────────────
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _nameCtrl     = TextEditingController();
  final _formKey      = GlobalKey<FormState>();

  bool _loading       = false;
  bool _obscurePass   = true;
  String? _errorMsg;

  // ── Animation ─────────────────────────────────────────────────────────────
  late final AnimationController _slideCtrl;
  late final Animation<double>   _fadeAnim;

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _slideCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  // ── Toggle mode ───────────────────────────────────────────────────────────
  void _toggleMode() {
    setState(() {
      _isLogin  = !_isLogin;
      _errorMsg = null;
    });
    _slideCtrl.forward(from: 0.0);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() { _loading = true; _errorMsg = null; });

    try {
      final PlayerModel player;

      if (_isLogin) {
        player = await AuthService.instance.signIn(
          email:    _emailCtrl.text.trim(),
          password: _passwordCtrl.text,
        );
      } else {
        player = await AuthService.instance.signUp(
          email:       _emailCtrl.text.trim(),
          password:    _passwordCtrl.text,
          displayName: _nameCtrl.text.trim(),
        );
      }

      // Init coin system after auth
      await OnboardingService.instance.init();
      await CoinService.instance.init(isNewPlayer: player.isNewPlayer);
      await WeeklyMissionService.instance.init();
      await AchievementService.instance.init();

      widget.onAuthenticated();
    } on AuthException catch (e) {
      setState(() => _errorMsg = _translateError(e.message));
    } catch (e) {
      setState(() => _errorMsg = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _translateError(String msg) {
    if (msg.contains('Invalid login')) return 'Email hoặc mật khẩu không đúng';
    if (msg.contains('already registered')) return 'Email này đã được đăng ký';
    if (msg.contains('Password should')) return 'Mật khẩu phải có ít nhất 6 ký tự';
    if (msg.contains('Unable to validate')) return 'Email không hợp lệ';
    if (msg.contains('network')) return 'Lỗi kết nối mạng, thử lại sau';
    return msg;
  }

  Future<void> _resetPassword() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _errorMsg = 'Nhập email để đặt lại mật khẩu');
      return;
    }
    try {
      await AuthService.instance.resetPassword(email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã gửi email đặt lại mật khẩu!'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
    } catch (_) {
      setState(() => _errorMsg = 'Không thể gửi email, kiểm tra lại địa chỉ');
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.translucent,
        child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildLogo(),
                    const SizedBox(height: 36),
                    _buildTitle(),
                    const SizedBox(height: 28),
                    if (!_isLogin) ...[
                      _buildField(
                        ctrl:  _nameCtrl,
                        label: 'Tên hiển thị',
                        hint:  'VD: Rồng Lửa 99',
                        icon:  Icons.person_rounded,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Nhập tên hiển thị';
                          if (v.trim().length < 2) return 'Tối thiểu 2 ký tự';
                          if (v.trim().length > 20) return 'Tối đa 20 ký tự';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),
                    ],
                    _buildField(
                      ctrl:     _emailCtrl,
                      label:    'Email',
                      hint:     'example@gmail.com',
                      icon:     Icons.email_rounded,
                      keyboard: TextInputType.emailAddress,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Nhập email';
                        if (!v.contains('@')) return 'Email không hợp lệ';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    _buildPasswordField(),
                    const SizedBox(height: 8),
                    if (_isLogin) _buildForgotPassword(),
                    if (_errorMsg != null) ...[
                      const SizedBox(height: 12),
                      _buildError(),
                    ],
                    const SizedBox(height: 24),
                    _buildSubmitButton(),
                    const SizedBox(height: 20),
                    _buildToggleMode(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
        ),
    );
  }

  // ── Widgets ───────────────────────────────────────────────────────────────

  Widget _buildLogo() {
    return Container(
      width: 90,
      height: 90,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C6FFF).withOpacity(0.45),
            blurRadius: 28,
            spreadRadius: 2,
          ),
        ],
      ),
      child: const Icon(Icons.sports_esports_rounded,
          color: Colors.white, size: 46),
    );
  }

  Widget _buildTitle() {
    return Column(
      children: [
        Text(
          _isLogin ? 'Đăng nhập' : 'Tạo tài khoản',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _isLogin
              ? 'Chào mừng trở lại Super Gate!'
              : 'Bắt đầu hành trình với 500 xu + 3 hộp quà',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xFF7777AA), fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildField({
    required TextEditingController ctrl,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboard = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: keyboard,
      style: const TextStyle(color: Colors.white, fontSize: 15),
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: const Color(0xFF7777AA), size: 20),
        labelStyle: const TextStyle(color: Color(0xFF7777AA), fontSize: 13),
        hintStyle: const TextStyle(color: Color(0xFF444466), fontSize: 13),
        filled: true,
        fillColor: const Color(0xFF0F0F22),
        contentPadding:
            const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF2A2A44)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF2A2A44)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF7C6FFF), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE53935)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5),
        ),
        errorStyle: const TextStyle(color: Color(0xFFE57373), fontSize: 11),
      ),
    );
  }

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordCtrl,
      obscureText: _obscurePass,
      style: const TextStyle(color: Colors.white, fontSize: 15),
      validator: (v) {
        if (v == null || v.isEmpty) return 'Nhập mật khẩu';
        if (v.length < 6) return 'Mật khẩu ít nhất 6 ký tự';
        return null;
      },
      decoration: InputDecoration(
        labelText: 'Mật khẩu',
        hintText: '••••••••',
        prefixIcon:
            const Icon(Icons.lock_rounded, color: Color(0xFF7777AA), size: 20),
        suffixIcon: IconButton(
          onPressed: () => setState(() => _obscurePass = !_obscurePass),
          icon: Icon(
            _obscurePass ? Icons.visibility_rounded : Icons.visibility_off_rounded,
            color: const Color(0xFF555577),
            size: 20,
          ),
        ),
        labelStyle: const TextStyle(color: Color(0xFF7777AA), fontSize: 13),
        hintStyle: const TextStyle(color: Color(0xFF444466), fontSize: 13),
        filled: true,
        fillColor: const Color(0xFF0F0F22),
        contentPadding:
            const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF2A2A44)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF2A2A44)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFF7C6FFF), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE53935)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFE53935), width: 1.5),
        ),
        errorStyle: const TextStyle(color: Color(0xFFE57373), fontSize: 11),
      ),
    );
  }

  Widget _buildForgotPassword() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: _resetPassword,
        style: TextButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text(
          'Quên mật khẩu?',
          style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A0505),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE53935).withOpacity(0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Color(0xFFE57373), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMsg!,
              style: const TextStyle(color: Color(0xFFE57373), fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: _loading ? null : _submit,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF7C6FFF),
          disabledBackgroundColor: const Color(0xFF2A2A44),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation(Colors.white54),
                ),
              )
            : Text(_isLogin ? 'Đăng nhập' : 'Tạo tài khoản'),
      ),
    );
  }

  Widget _buildToggleMode() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          _isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? ',
          style: const TextStyle(color: Color(0xFF666688), fontSize: 13),
        ),
        GestureDetector(
          onTap: _toggleMode,
          child: Text(
            _isLogin ? 'Đăng ký ngay' : 'Đăng nhập',
            style: const TextStyle(
              color: Color(0xFF7C6FFF),
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}
