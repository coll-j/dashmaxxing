import os
import base64
from google.cloud import kms
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LOCATION_ID = os.getenv("GCP_LOCATION", "global")
KEY_RING_ID = os.getenv("GCP_KEYRING", "dashmaxxing-keyring")
KEY_ID = os.getenv("GCP_KEY_NAME", "dashmaxxing-key")

def get_key_name() -> str:
    client = kms.KeyManagementServiceClient()
    return client.crypto_key_path(PROJECT_ID, LOCATION_ID, KEY_RING_ID, KEY_ID)

def encrypt_symmetric(plaintext: str) -> str:
    """Encrypts plaintext using Google Cloud KMS."""
    if not plaintext:
        return ""
    
    # Check if we have credentials set, else fail safely
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return plaintext

    try:
        client = kms.KeyManagementServiceClient()
        key_name = get_key_name()
        
        request = {
            "name": key_name,
            "plaintext": plaintext.encode("utf-8"),
        }
        
        response = client.encrypt(request=request)
        return base64.b64encode(response.ciphertext).decode("utf-8")
    except Exception as e:
        print(f"KMS Encryption warning: {e}")
        raise ValueError("Encryption failed, please check GCP details.")

def decrypt_symmetric(ciphertext: str) -> str:
    """Decrypts ciphertext using Google Cloud KMS."""
    if not ciphertext:
        return ""
        
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return ciphertext

    try:
        client = kms.KeyManagementServiceClient()
        key_name = get_key_name()
        
        request = {
            "name": key_name,
            "ciphertext": base64.b64decode(ciphertext),
        }
        
        response = client.decrypt(request=request)
        return response.plaintext.decode("utf-8")
    except Exception as e:
        print(f"KMS Decryption failed: {e}")
        raise ValueError("Decryption failed, please check GCP details.")
