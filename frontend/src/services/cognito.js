import { DEFAULT_CONFIG } from '../config';

const getCognitoUrl = () => {
  const region = DEFAULT_CONFIG.cognito.region || 'ap-southeast-2';
  return `https://cognito-idp.${region}.amazonaws.com/`;
};

export const cognitoService = {
  async signUp(email, password, name, accountType = 'visitor') {
    const clientId = localStorage.getItem('nexus_client_id') || DEFAULT_CONFIG.cognito.clientId;
    const body = {
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'profile', Value: accountType === 'student' ? 'student-requested' : 'visitor' }
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

  async signIn(email, password, accountType = null) {
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

    if (!idToken) throw new Error('This authentication challenge is not supported by this sign-in form.');
    const encoded = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];
    const isStudent = groups.includes('students');
    const role = groups.includes('admins') ? 'admin' : isStudent ? 'student' : 'visitor';
    if (accountType === 'student' && !isStudent && role !== 'admin') {
      throw new Error('Student access has not been approved for this account. Choose Visitor to book events while approval is pending.');
    }
    if (accountType === 'visitor' && role !== 'visitor') {
      throw new Error('This is a campus account. Choose Student to sign in.');
    }
    return {
      id: payload.sub, name: payload.name || email.split('@')[0], email: payload.email || email,
      role, isStudent, studentRequested: payload.profile === 'student-requested' && !isStudent,
      token: idToken, accessToken, avatar: role === 'admin' ? '🛡️' : isStudent ? '🎓' : '👤'
    };
  }
};
