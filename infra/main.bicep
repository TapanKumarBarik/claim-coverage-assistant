// One Linux App Service serving the API and the React build, with secrets in Key Vault.
//
//   az group create -n rg-claims-demo -l westeurope
//   az deployment group create -g rg-claims-demo -f infra/main.bicep -p webAppName=<unique-name>
//
// No secret passes through this template. Secrets are written to the vault afterwards (see the README) and
// the app reads them through Key Vault references, using its managed identity. Azure OpenAI is reached with
// the same identity, so on a public instance there is no API key to leak at all: visitors bring their own.
targetScope = 'resourceGroup'

@description('Globally unique name; the app is served at https://<name>.azurewebsites.net')
param webAppName string

param location string = resourceGroup().location

@description('F1 is the free tier (60 CPU-minutes/day, 1 GB RAM, no always-on). Use B1 or above for anything beyond a demo.')
@allowed(['F1', 'B1', 'B2', 'P0v3'])
param planSku string = 'F1'

@description('Let visitors connect their own Azure OpenAI resource. Keep true for a public instance.')
param allowByoCredentials bool = true

@description('OPTIONAL operator-paid model access: https://<resource>.openai.azure.com. Leave empty on a public instance.')
param azureOpenAiEndpoint string = ''

@description('Deployment name of the thinking model (only with azureOpenAiEndpoint).')
param azureOpenAiReasoningDeployment string = ''

@description('Deployment name of the small model for greetings (optional).')
param azureOpenAiFastDeployment string = ''

@description('Deployment name of the embeddings model (optional).')
param azureOpenAiEmbeddingDeployment string = ''

@description('Authenticate to Azure OpenAI with an API key kept in Key Vault instead of the managed identity. Not recommended.')
param useApiKey bool = false

var vaultName = take('${webAppName}-kv', 24)
var keyVaultSecretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6' // built-in "Key Vault Secrets User"

func secretRef(secretName string) string => '@Microsoft.KeyVault(VaultName=${vaultName};SecretName=${secretName})'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true // access is granted by role, not by vault access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${webAppName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: planSku
  }
  properties: {
    reserved: true // Linux
  }
}

var baseSettings = [
  { name: 'APP_ENV', value: 'production' }
  { name: 'STORAGE_DIR', value: '/home/data/storage' } // /home survives restarts and redeploys
  { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'true' }
  { name: 'WEBSITES_PORT', value: '8000' }
  { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' } // Oryx installs requirements.txt
  { name: 'ALLOW_BYO_CREDENTIALS', value: string(allowByoCredentials) }
  { name: 'ADMIN_TOKEN_SHA256', value: secretRef('admin-token-sha256') } // a hash, never the token
]

var serverModelSettings = empty(azureOpenAiEndpoint)
  ? []
  : concat(
      [
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
        { name: 'AZURE_OPENAI_REASONING_DEPLOYMENT', value: azureOpenAiReasoningDeployment }
        { name: 'AZURE_OPENAI_FAST_DEPLOYMENT', value: azureOpenAiFastDeployment }
        { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', value: azureOpenAiEmbeddingDeployment }
      ],
      useApiKey ? [{ name: 'AZURE_OPENAI_API_KEY', value: secretRef('azure-openai-api-key') }] : []
    )

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    keyVaultReferenceIdentity: 'SystemAssigned'
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.13'
      // One worker: state (catalogue, sessions, rate limits) lives in this process and in /home/data.
      appCommandLine: 'gunicorn -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000 --timeout 120 "app.main:create_app()"'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      alwaysOn: false // not available on F1
      appSettings: concat(baseSettings, serverModelSettings)
    }
  }
}

resource appCanReadSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, app.id, keyVaultSecretsUserRole)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output url string = 'https://${app.properties.defaultHostName}'
output adminUrl string = 'https://${app.properties.defaultHostName}/#/admin'
output vaultName string = vault.name
@description('Grant this identity "Cognitive Services OpenAI User" on your Azure OpenAI resource to use managed identity.')
output appPrincipalId string = app.identity.principalId
