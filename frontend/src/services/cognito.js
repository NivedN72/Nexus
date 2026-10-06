import { DEFAULT_CONFIG } from '../config';

const getCognitoUrl = () => {
  const region = DEFAULT_CONFIG.cognito.region || 'ap-southeast-2';
  return `https://cognito-idp.${region}.amazonaws.com/`;
};

const cognitoError = (data, fallback) => {
  const error = new Error(data.message || fallback);
  error.code = (data.__type || '').split('#').pop();
  return error;
};

const parseAuthResponse = (data, email, accountType, clientId) => {
  if (!data.AuthenticationResult?.IdToken) {
    if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED' && data.Session) {
      const parameters = data.ChallengeParameters || {};
      const required = JSON.parse(parameters.requiredAttributes || '[]');
      const attributes = JSON.parse(parameters.userAttributes || '{}');
      if (!Array.isArray(required) || required.some(key => typeof key !== 'string')) {
        throw new Error('Invalid required account details. Please restart sign-in.');
      }
      return {
        challengeName: 'NEW_PASSWORD_REQUIRED', session: data.Session,
        username: parameters.USER_ID_FOR_SRP || parameters.USERNAME || email,
        email, accountType, clientId,
        requiredAttributes: required.map(key => key.replace(/^userAttributes\./, '')),
        attributes,
      };
    }
    throw new Error(data.ChallengeName
      ? `An additional ${data.ChallengeName} step is required. This sign-in form does not support it yet.`
      : 'Sign-in did not return a token. Please try again.');
  }
    const idToken = data.AuthenticationResult?.IdToken;
    const accessToken = data.AuthenticationResult?.AccessToken;


    const encoded = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];
    const isStudent = groups.includes('students');
    const role = groups.includes('admins') ? 'admin' : isStudent ? 'student' : 'visitor';
    if (accountType === 'student' && !isStudent && role !== 'admin') {
      const error = new Error('Student access has not been approved for this account. Choose Visitor to book events while approval is pending.');
      error.code = 'AccountTypeMismatch'; throw error;
    }
    if (accountType === 'visitor' && role !== 'visitor') {
      const error = new Error('This is a campus account. Choose Student to sign in.');
      error.code = 'AccountTypeMismatch'; throw error;
    }
    return {
      id: payload.sub, name: payload.name || email.split('@')[0], email: payload.email || email,
      role, isStudent, studentRequested: payload.profile === 'student-requested' && !isStudent,
      token: idToken, accessToken, avatar: role === 'admin' ? '🛡️' : isStudent ? '🎓' : '👤'
    };
};

export const cognitoService = {
  async signUp(email, password, name) {
    const clientId = localStorage.getItem('nexus_client_id') || DEFAULT_CONFIG.cognito.clientId;
    const body = {
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'profile', Value: 'visitor' }
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
    if (!res.ok) throw cognitoError(data, 'Sign up failed');
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
    if (!res.ok) throw cognitoError(data, 'Verification failed');
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
    if (!res.ok) throw cognitoError(data, 'Sign in failed');
    
    return parseAuthResponse(data, email, accountType, clientId);
  },

  async completeNewPassword(challenge, newPassword, attributes = {}) {
    if (challenge?.challengeName !== 'NEW_PASSWORD_REQUIRED' || !challenge.session) {
      throw new Error('Please restart sign-in before setting a new password.');
    }
    if (!newPassword) throw new Error('Enter a new password.');
    const responses = { USERNAME: challenge.username, NEW_PASSWORD: newPassword };
    for (const key of challenge.requiredAttributes) {
      const value = attributes[key];
      if (typeof value !== 'string' || !value.trim()) throw new Error(`Enter your ${key.replace(/_/g, ' ')}.`);
      responses[`userAttributes.${key}`] = value.trim();
    }
    const res = await fetch(getCognitoUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge' },
      body: JSON.stringify({
        ClientId: challenge.clientId, ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: challenge.session, ChallengeResponses: responses,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw cognitoError(data, 'Could not set your new password.');
    try {
      return parseAuthResponse(data, challenge.email, challenge.accountType, challenge.clientId);
    } catch (error) {
      // A role mismatch must not leave the UI retrying an already-consumed password session.
      if (data.AuthenticationResult?.IdToken || (data.ChallengeName && data.ChallengeName !== 'NEW_PASSWORD_REQUIRED')) error.passwordChanged = true;
      throw error;
    }
  }
};
