export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ata: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          cenario_id: string
          conteudo: Json | null
          gerada_em: string
          id: string
          justificativa_revisao: string | null
          pontos_abertos: Json
          proximos_passos: string | null
          ressalvas: string | null
          rfp_id: string | null
          snapshot: Json | null
          snapshot_hash: string | null
          status: string
          texto: string | null
          versao: number
          versao_anterior: string | null
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          cenario_id: string
          conteudo?: Json | null
          gerada_em?: string
          id?: string
          justificativa_revisao?: string | null
          pontos_abertos?: Json
          proximos_passos?: string | null
          ressalvas?: string | null
          rfp_id?: string | null
          snapshot?: Json | null
          snapshot_hash?: string | null
          status?: string
          texto?: string | null
          versao?: number
          versao_anterior?: string | null
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          cenario_id?: string
          conteudo?: Json | null
          gerada_em?: string
          id?: string
          justificativa_revisao?: string | null
          pontos_abertos?: Json
          proximos_passos?: string | null
          ressalvas?: string | null
          rfp_id?: string | null
          snapshot?: Json | null
          snapshot_hash?: string | null
          status?: string
          texto?: string | null
          versao?: number
          versao_anterior?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ata_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_versao_anterior_fkey"
            columns: ["versao_anterior"]
            isOneToOne: false
            referencedRelation: "ata"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_aceite: {
        Row: {
          aceito_em: string
          ata_id: string
          ip: string | null
          nome: string
          socio_id: string
        }
        Insert: {
          aceito_em?: string
          ata_id: string
          ip?: string | null
          nome: string
          socio_id?: string
        }
        Update: {
          aceito_em?: string
          ata_id?: string
          ip?: string | null
          nome?: string
          socio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_aceite_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "ata"
            referencedColumns: ["id"]
          },
        ]
      }
      cenario: {
        Row: {
          atualizado_em: string
          autor: string | null
          config: Json
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          parecer: string | null
          parecer_revisado: boolean
          recomendado: boolean
          versao: number
        }
        Insert: {
          atualizado_em?: string
          autor?: string | null
          config?: Json
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          parecer?: string | null
          parecer_revisado?: boolean
          recomendado?: boolean
          versao?: number
        }
        Update: {
          atualizado_em?: string
          autor?: string | null
          config?: Json
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          parecer?: string | null
          parecer_revisado?: boolean
          recomendado?: boolean
          versao?: number
        }
        Relationships: []
      }
      cenario_comentario: {
        Row: {
          autor: string
          cenario_id: string
          criado_em: string
          id: string
          texto: string
        }
        Insert: {
          autor?: string
          cenario_id: string
          criado_em?: string
          id?: string
          texto: string
        }
        Update: {
          autor?: string
          cenario_id?: string
          criado_em?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "cenario_comentario_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
        ]
      }
      cenario_modulo: {
        Row: {
          cenario_id: string
          comentario: string | null
          modulo_id: string
          opcao: string
          proposta_id: string | null
        }
        Insert: {
          cenario_id: string
          comentario?: string | null
          modulo_id: string
          opcao?: string
          proposta_id?: string | null
        }
        Update: {
          cenario_id?: string
          comentario?: string | null
          modulo_id?: string
          opcao?: string
          proposta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cenario_modulo_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cenario_modulo_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cenario_modulo_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      cenario_versao: {
        Row: {
          autor: string | null
          cenario_id: string
          criado_em: string
          id: string
          snapshot: Json
          versao: number
        }
        Insert: {
          autor?: string | null
          cenario_id: string
          criado_em?: string
          id?: string
          snapshot: Json
          versao: number
        }
        Update: {
          autor?: string | null
          cenario_id?: string
          criado_em?: string
          id?: string
          snapshot?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cenario_versao_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_equalizacao: {
        Row: {
          atualizado_em: string
          chave: string
          concluido: boolean
          observacao: string | null
          proposta_id: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          concluido?: boolean
          observacao?: string | null
          proposta_id: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          concluido?: boolean
          observacao?: string | null
          proposta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_equalizacao_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      cobertura: {
        Row: {
          avaliado_em: string
          avaliado_por: string | null
          custo_estimado_para_cobrir: number | null
          evidencia: string
          fonte_pagina: string | null
          id: string
          nivel: number | null
          nota_tecnica: string | null
          proposta_id: string
          requisito_id: string
        }
        Insert: {
          avaliado_em?: string
          avaliado_por?: string | null
          custo_estimado_para_cobrir?: number | null
          evidencia?: string
          fonte_pagina?: string | null
          id?: string
          nivel?: number | null
          nota_tecnica?: string | null
          proposta_id: string
          requisito_id: string
        }
        Update: {
          avaliado_em?: string
          avaliado_por?: string | null
          custo_estimado_para_cobrir?: number | null
          evidencia?: string
          fonte_pagina?: string | null
          id?: string
          nivel?: number | null
          nota_tecnica?: string | null
          proposta_id?: string
          requisito_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobertura_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobertura_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "requisito"
            referencedColumns: ["id"]
          },
        ]
      }
      comentario_tecnico: {
        Row: {
          criado_em: string
          id: string
          modulo_id: string | null
          proposta_id: string | null
          texto: string
        }
        Insert: {
          criado_em?: string
          id?: string
          modulo_id?: string | null
          proposta_id?: string | null
          texto: string
        }
        Update: {
          criado_em?: string
          id?: string
          modulo_id?: string | null
          proposta_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentario_tecnico_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_tecnico_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      criterio: {
        Row: {
          descricao: string | null
          id: string
          nome: string
          peso: number
          rfp_id: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          nome: string
          peso: number
          rfp_id: string
        }
        Update: {
          descricao?: string | null
          id?: string
          nome?: string
          peso?: number
          rfp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "criterio_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      entrega_declarada: {
        Row: {
          categoria: string
          e_teto: boolean
          id: string
          observacao: string | null
          proposta_id: string
          quantidade_mes: number
        }
        Insert: {
          categoria: string
          e_teto?: boolean
          id?: string
          observacao?: string | null
          proposta_id: string
          quantidade_mes?: number
        }
        Update: {
          categoria?: string
          e_teto?: boolean
          id?: string
          observacao?: string | null
          proposta_id?: string
          quantidade_mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "entrega_declarada_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      exportacao: {
        Row: {
          id: string
          quando: string
          quem: string
          referencia: string | null
          tipo: string
        }
        Insert: {
          id?: string
          quando?: string
          quem?: string
          referencia?: string | null
          tipo: string
        }
        Update: {
          id?: string
          quando?: string
          quem?: string
          referencia?: string | null
          tipo?: string
        }
        Relationships: []
      }
      filtro_salvo: {
        Row: {
          criado_em: string
          dono: string
          id: string
          nome: string
          parametros: Json
        }
        Insert: {
          criado_em?: string
          dono?: string
          id?: string
          nome: string
          parametros: Json
        }
        Update: {
          criado_em?: string
          dono?: string
          id?: string
          nome?: string
          parametros?: Json
        }
        Relationships: []
      }
      item_proposta: {
        Row: {
          cronograma_pagamento: Json | null
          descricao: string
          entrega_chave: string | null
          fonte_pagina: string | null
          id: string
          incerteza: string | null
          incluido_no_subtotal_da_proposta: boolean
          modulo_id: string | null
          multiplicador: number
          premissa_imputacao: string | null
          proposta_id: string
          sujeito_desconto_lista: boolean
          teto_verba_mensal: number | null
          tipo_preco: string
          unidade: string
          valor_lista: number | null
          valor_max: number | null
          valor_min: number | null
          valor_negociado: number | null
        }
        Insert: {
          cronograma_pagamento?: Json | null
          descricao: string
          entrega_chave?: string | null
          fonte_pagina?: string | null
          id?: string
          incerteza?: string | null
          incluido_no_subtotal_da_proposta?: boolean
          modulo_id?: string | null
          multiplicador?: number
          premissa_imputacao?: string | null
          proposta_id: string
          sujeito_desconto_lista?: boolean
          teto_verba_mensal?: number | null
          tipo_preco: string
          unidade?: string
          valor_lista?: number | null
          valor_max?: number | null
          valor_min?: number | null
          valor_negociado?: number | null
        }
        Update: {
          cronograma_pagamento?: Json | null
          descricao?: string
          entrega_chave?: string | null
          fonte_pagina?: string | null
          id?: string
          incerteza?: string | null
          incluido_no_subtotal_da_proposta?: boolean
          modulo_id?: string | null
          multiplicador?: number
          premissa_imputacao?: string | null
          proposta_id?: string
          sujeito_desconto_lista?: boolean
          teto_verba_mensal?: number | null
          tipo_preco?: string
          unidade?: string
          valor_lista?: number | null
          valor_max?: number | null
          valor_min?: number | null
          valor_negociado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_proposta_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_proposta_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      log_auditoria: {
        Row: {
          antes: Json | null
          depois: Json | null
          id: number
          operacao: string
          quando: string
          quem: string | null
          registro: string | null
          tabela: string
        }
        Insert: {
          antes?: Json | null
          depois?: Json | null
          id?: number
          operacao: string
          quando?: string
          quem?: string | null
          registro?: string | null
          tabela: string
        }
        Update: {
          antes?: Json | null
          depois?: Json | null
          id?: number
          operacao?: string
          quando?: string
          quem?: string | null
          registro?: string | null
          tabela?: string
        }
        Relationships: []
      }
      modulo: {
        Row: {
          codigo: string
          descricao: string | null
          entrega_chave: string | null
          essencial: boolean
          id: string
          nome: string
          peso_no_rfp: number
          rfp_id: string
        }
        Insert: {
          codigo: string
          descricao?: string | null
          entrega_chave?: string | null
          essencial?: boolean
          id?: string
          nome: string
          peso_no_rfp?: number
          rfp_id: string
        }
        Update: {
          codigo?: string
          descricao?: string | null
          entrega_chave?: string | null
          essencial?: boolean
          id?: string
          nome?: string
          peso_no_rfp?: number
          rfp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulo_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_socio: {
        Row: {
          criterio_id: string
          enviado_em: string
          justificativa: string | null
          nota: number
          proposta_id: string
          socio_id: string
        }
        Insert: {
          criterio_id: string
          enviado_em?: string
          justificativa?: string | null
          nota: number
          proposta_id: string
          socio_id?: string
        }
        Update: {
          criterio_id?: string
          enviado_em?: string
          justificativa?: string | null
          nota?: number
          proposta_id?: string
          socio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nota_socio_criterio_id_fkey"
            columns: ["criterio_id"]
            isOneToOne: false
            referencedRelation: "criterio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_socio_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      pergunta_filtro: {
        Row: {
          id: string
          rfp_id: string
          texto: string
        }
        Insert: {
          id?: string
          rfp_id: string
          texto: string
        }
        Update: {
          id?: string
          rfp_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "pergunta_filtro_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      player: {
        Row: {
          cidade: string | null
          cor_token: string | null
          id: string
          nome: string
          observacoes: string | null
          rfp_numeros: number[]
          status: string
          tipo: string
        }
        Insert: {
          cidade?: string | null
          cor_token?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          rfp_numeros?: number[]
          status?: string
          tipo: string
        }
        Update: {
          cidade?: string | null
          cor_token?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          rfp_numeros?: number[]
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      ponto_atencao: {
        Row: {
          acao_sugerida: string | null
          escopo: string
          id: string
          origem: string
          referencia_id: string | null
          regra_codigo: string | null
          severidade: string
          texto: string
        }
        Insert: {
          acao_sugerida?: string | null
          escopo: string
          id?: string
          origem?: string
          referencia_id?: string | null
          regra_codigo?: string | null
          severidade: string
          texto: string
        }
        Update: {
          acao_sugerida?: string | null
          escopo?: string
          id?: string
          origem?: string
          referencia_id?: string | null
          regra_codigo?: string | null
          severidade?: string
          texto?: string
        }
        Relationships: []
      }
      portao: {
        Row: {
          descricao: string
          id: string
          requisito_id: string | null
          rfp_id: string
        }
        Insert: {
          descricao: string
          id?: string
          requisito_id?: string | null
          rfp_id: string
        }
        Update: {
          descricao?: string
          id?: string
          requisito_id?: string | null
          rfp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portao_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "requisito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portao_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      portao_resultado: {
        Row: {
          evidencia: string | null
          justificativa: string | null
          portao_id: string
          proposta_id: string
          resultado: string
        }
        Insert: {
          evidencia?: string | null
          justificativa?: string | null
          portao_id: string
          proposta_id: string
          resultado?: string
        }
        Update: {
          evidencia?: string | null
          justificativa?: string | null
          portao_id?: string
          proposta_id?: string
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "portao_resultado_portao_id_fkey"
            columns: ["portao_id"]
            isOneToOne: false
            referencedRelation: "portao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portao_resultado_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      premissa: {
        Row: {
          chave: string
          descricao: string | null
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          valor?: Json
        }
        Relationships: []
      }
      premorte: {
        Row: {
          cenario_id: string
          enviado_em: string
          socio_id: string
          texto: string
        }
        Insert: {
          cenario_id: string
          enviado_em?: string
          socio_id?: string
          texto: string
        }
        Update: {
          cenario_id?: string
          enviado_em?: string
          socio_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "premorte_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      proposta: {
        Row: {
          contrato_meses_proposto: number | null
          data_proposta: string | null
          desconto_explicito: string | null
          exclusoes: string | null
          fonte_arquivo: string | null
          id: string
          observacoes: string | null
          player_id: string
          reajuste: string | null
          status: string
          tributos: string | null
          validade_ate: string | null
          validade_dias: number | null
          versao: number
        }
        Insert: {
          contrato_meses_proposto?: number | null
          data_proposta?: string | null
          desconto_explicito?: string | null
          exclusoes?: string | null
          fonte_arquivo?: string | null
          id?: string
          observacoes?: string | null
          player_id: string
          reajuste?: string | null
          status?: string
          tributos?: string | null
          validade_ate?: string | null
          validade_dias?: number | null
          versao?: number
        }
        Update: {
          contrato_meses_proposto?: number | null
          data_proposta?: string | null
          desconto_explicito?: string | null
          exclusoes?: string | null
          fonte_arquivo?: string | null
          id?: string
          observacoes?: string | null
          player_id?: string
          reajuste?: string | null
          status?: string
          tributos?: string | null
          validade_ate?: string | null
          validade_dias?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_arquivo: {
        Row: {
          caminho: string
          enviado_em: string
          id: string
          nome: string
          proposta_id: string
          versao: number
        }
        Insert: {
          caminho: string
          enviado_em?: string
          id?: string
          nome: string
          proposta_id: string
          versao?: number
        }
        Update: {
          caminho?: string
          enviado_em?: string
          id?: string
          nome?: string
          proposta_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_arquivo_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      requisito: {
        Row: {
          codigo: string | null
          criticidade: string
          descricao: string
          eliminatorio: boolean
          fonte: string | null
          id: string
          modulo_id: string
          peso: number
        }
        Insert: {
          codigo?: string | null
          criticidade?: string
          descricao: string
          eliminatorio?: boolean
          fonte?: string | null
          id?: string
          modulo_id: string
          peso?: number
        }
        Update: {
          codigo?: string | null
          criticidade?: string
          descricao?: string
          eliminatorio?: boolean
          fonte?: string | null
          id?: string
          modulo_id?: string
          peso?: number
        }
        Relationships: [
          {
            foreignKeyName: "requisito_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulo"
            referencedColumns: ["id"]
          },
        ]
      }
      resposta_filtro: {
        Row: {
          avaliacao: string | null
          id: string
          pergunta_id: string
          proposta_id: string
          resposta: string | null
          sem_resposta: boolean
        }
        Insert: {
          avaliacao?: string | null
          id?: string
          pergunta_id: string
          proposta_id: string
          resposta?: string | null
          sem_resposta?: boolean
        }
        Update: {
          avaliacao?: string | null
          id?: string
          pergunta_id?: string
          proposta_id?: string
          resposta?: string | null
          sem_resposta?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "resposta_filtro_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "pergunta_filtro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resposta_filtro_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      revelacao: {
        Row: {
          revelado_em: string
          revelado_por: string | null
          rfp_id: string
        }
        Insert: {
          revelado_em?: string
          revelado_por?: string | null
          rfp_id: string
        }
        Update: {
          revelado_em?: string
          revelado_por?: string | null
          rfp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revelacao_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: true
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp: {
        Row: {
          descricao: string | null
          fase: number
          id: string
          janela_meses: number
          nome: string
          numero: number
          periodo: string | null
          status: string
        }
        Insert: {
          descricao?: string | null
          fase?: number
          id?: string
          janela_meses?: number
          nome: string
          numero: number
          periodo?: string | null
          status?: string
        }
        Update: {
          descricao?: string | null
          fase?: number
          id?: string
          janela_meses?: number
          nome?: string
          numero?: number
          periodo?: string | null
          status?: string
        }
        Relationships: []
      }
      trilha_decisao: {
        Row: {
          atualizado_em: string
          cenario_candidato: string | null
          encerrada_quorum: boolean
          pontuacao_aberta: boolean
          pontuacao_aberta_em: string | null
          regra_decisao: string
          rfp_id: string
          votacao_aberta: boolean
          votacao_encerrada: boolean
        }
        Insert: {
          atualizado_em?: string
          cenario_candidato?: string | null
          encerrada_quorum?: boolean
          pontuacao_aberta?: boolean
          pontuacao_aberta_em?: string | null
          regra_decisao?: string
          rfp_id: string
          votacao_aberta?: boolean
          votacao_encerrada?: boolean
        }
        Update: {
          atualizado_em?: string
          cenario_candidato?: string | null
          encerrada_quorum?: boolean
          pontuacao_aberta?: boolean
          pontuacao_aberta_em?: string | null
          regra_decisao?: string
          rfp_id?: string
          votacao_aberta?: boolean
          votacao_encerrada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trilha_decisao_cenario_candidato_fkey"
            columns: ["cenario_candidato"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_decisao_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: true
            referencedRelation: "rfp"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voto: {
        Row: {
          cenario_id: string
          criado_em: string
          decisao: string
          justificativa: string | null
          socio_id: string
        }
        Insert: {
          cenario_id: string
          criado_em?: string
          decisao: string
          justificativa?: string | null
          socio_id?: string
        }
        Update: {
          cenario_id?: string
          criado_em?: string
          decisao?: string
          justificativa?: string | null
          socio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voto_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cenario"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      envios_pontuacao: {
        Args: { _rfp: string }
        Returns: {
          enviado_em: string
          notas: number
          socio_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      notas_reveladas: { Args: { _criterio: string }; Returns: boolean }
      pode_editar_cenario: { Args: { _cenario: string }; Returns: boolean }
      pode_votar: { Args: { _cenario: string }; Returns: boolean }
      pontuacao_aberta: { Args: { _criterio: string }; Returns: boolean }
      premortes_visiveis: { Args: { _cenario: string }; Returns: boolean }
      recomendar_cenario: { Args: { _cenario: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "socio" | "observador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "socio", "observador"],
    },
  },
} as const
