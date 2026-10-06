import { DEFAULT_CONFIG } from '../config';

const getCognitoUrl = () => {
  const region = DEFAULT_CONFIG.cognito.region || 'ap-southeast-2';
  return `https://cognito-idp.${region}.amazonaws.com/`;
};

export const DEMO_PROFILES = [
  { id: 'alice', name: 'Alice (Student)', email: 'student-alice@campus.edu', role: 'student', avatar: '👩‍🎓' },
  { id: 'bob', name: 'Bob (Student)', email: 'student-bob@campus.edu', role: 'student', avatar: '👨‍🎓' },
  { id: 'admin', name: 'Campus Admin', email: 'admin@campus.edu', role: 'admin', avatar: '🛡️' }
];

export const cognitoService = {
  async signUp(email, password, name) {
    const clientId = localStorage.getItem('nexus_client_id') || DEFAULT_CONFIG.cognito.clientId;
    const body = {
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name }
      ]
    };

    const res = await fetch(getCognitoUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.__type || 'Sign up failed');
    return data;
  },

  async confirmSignUp(email, code) {
    const clientId = localStorage.getItem('nexus_client_id') || DEFAULT_CONFIG.cognito.clientId;
    const body = {
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code
    };

    const res = await fetch(getCognitoUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.__type || 'Verification failed');
    return data;
  },

  async signIn(email, password) {
    const clientId = localStorage.getItem('nexus_client_id') || DEFAULT_CONFIG.cognito.clientId;
    const body = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    const res = await fetch(getCognitoUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.__type || 'Sign in failed');
    
    const idToken = data.AuthenticationResult?.IdToken;
    const accessToken = data.AuthenticationResult?.AccessToken;

    // Decode payload to extract user groups / claims
    let role = 'student';
    let name = email.split('@')[0];
    try {
      const payloadBase64 = idToken.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      if (payload['cognito:groups']?.includes('admins')) {
        role = 'admin';
      }
      if (payload.name) {
        name = payload.name;
      }
    } catch (e) {
      console.warn('Could not parse token claims:', e);
    }

    return { 
      id: email, 
      name, 
      email, 
      role, 
      token: idToken, 
      accessToken, 
      avatar: role === 'admin' ? '🛡️' : '🎓' 
    };
  }
};
