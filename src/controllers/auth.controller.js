import * as AuthService from '../services/auth.service.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Korisničko ime i šifra su obavezni',
      });
    }

    const result = await AuthService.login(username, password);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Uspješno logovanje',
        user: result.user,
        token: result.token,
      });
    }

    if (result.blokirano) {
      return res.status(429).json({
        success: false,
        message: 'Previše pogrešnih pokušaja. Pokušaj ponovo za 15 minuta.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Pogrešno korisničko ime ili šifra',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Greška pri obradi zahtjeva',
    });
  }
};
