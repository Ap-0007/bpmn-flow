#!/bin/bash
# Script para iniciar o projeto em modo desenvolvimento

echo "🔄 Iniciando BPMN Visualizador..."

# Limpa arquivos antigos se existirem
echo "📁 Limpando arquivos antigos..."
rm -rf dist/

# Compila TypeScript se necessário
echo "🔧 Verificando TypeScript..."
if command -v npx &> /dev/null; then
    echo "✅ Compilando TypeScript..."
    npx tsc --noEmit
else
    echo "⚠️  TypeScript não encontrado, usando arquivos JavaScript existentes"
fi

# Inicia servidor
echo "🌐 Iniciando servidor HTTP..."
echo "📂 Servindo arquivos da pasta atual"
echo "🔗 Acesse: http://localhost:8000"
echo "👆 Use Ctrl+C para parar o servidor"
echo ""

python -m http.server 8000
