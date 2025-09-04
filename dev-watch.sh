#!/bin/bash
# Script para desenvolvimento com TypeScript
# Compila automaticamente quando arquivos .ts mudam

echo "🔄 Iniciando modo de desenvolvimento TypeScript..."
echo "📝 Editando arquivos .ts, compilando para .js automaticamente"
echo "🌐 Servidor em http://localhost:8000"
echo ""

# Compila uma vez primeiro
echo "📦 Compilação inicial..."
npx tsc

# Inicia compilação em watch mode em background
echo "👀 Iniciando watch mode para TypeScript..."
npx tsc --watch &
TSC_PID=$!

# Inicia servidor HTTP
echo "🚀 Iniciando servidor HTTP..."
python -m http.server 8000 &
SERVER_PID=$!

echo ""
echo "✅ Pronto! Pressione Ctrl+C para parar"
echo ""

# Aguarda sinal para parar
trap 'echo "🛑 Parando serviços..."; kill $TSC_PID $SERVER_PID; exit' INT

# Mantém script rodando
wait
