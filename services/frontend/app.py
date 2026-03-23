import streamlit as st
import requests
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import json

API_URL = "http://localhost:8000"

st.set_page_config(page_title="Comparatif IC vs AC", layout="wide")
st.title("Datacenter IA : Comparatif des Technologies de Refroidissement")

# --- 1. RÉCUPÉRATION DU RÉFÉRENTIEL ---
@st.cache_data
def get_referentiel():
    try:
        response = requests.get(f"{API_URL}/referentiel")
        if response.status_code == 200:
            return response.json()
    except:
        return None

referentiel = get_referentiel()

if not referentiel:
    st.error("❌ Impossible de charger les données du serveur. Vérifie que Docker tourne.")
    st.stop()

liste_technos = [t["techno"] for t in referentiel["technos"]]
liste_mix = [m["scenario"] for m in referentiel["mix"]]

# --- 2. BARRE LATÉRALE ---
st.sidebar.header("⚙️ Paramètres de simulation")

with st.sidebar.form("formulaire_calcul"):
    technos_choisies = st.multiselect("Technologies à comparer", options=liste_technos, default=["AC", "IC"])
    p_it_kw = st.slider("Charge IT (kW)", min_value=100, max_value=5000, value=1000, step=100)
    mix_choisi = st.selectbox("Scénario Mix Électrique", options=liste_mix)
    prix_kwh = st.number_input("Prix de l'électricité (€/kWh)", value=0.15, step=0.01)
    
    bouton_calculer = st.form_submit_button("🚀 Lancer le calcul", type="primary")

# --- 3. MOTEUR D'AFFICHAGE ---
if bouton_calculer:
    if len(technos_choisies) == 0:
        st.warning("⚠️ Veuillez sélectionner au moins une technologie.")
    else:
        payload = {"p_it_kw": p_it_kw, "technos": technos_choisies, "mix_scenario": mix_choisi, "prix_kwh": prix_kwh}
        
        with st.spinner("Calcul en cours sur le serveur..."):
            try:
                reponse_calcul = requests.post(f"{API_URL}/calculate", json=payload)
                
                if reponse_calcul.status_code == 200:
                    resultats = reponse_calcul.json().get("resultats", [])
                    resultats_filtres = [r for r in resultats if r.get("mix_scenario") == mix_choisi]

                    st.success("✅ Calcul réussi !")

                    # --- POINT 6 : METRIC CARDS ---
                    st.subheader("📊 Indicateurs Clés (AC vs IC)")
                    data_ac = next((r for r in resultats_filtres if r["techno"] == "AC"), None)
                    data_ic = next((r for r in resultats_filtres if r["techno"] == "IC"), None)

                    if data_ac and data_ic:
                        col1, col2, col3, col4 = st.columns(4)
                        
                        racks_ac = data_ac.get("nb_racks", {}).get("valeur", 0)
                        racks_ic = data_ic.get("nb_racks", {}).get("valeur", 0)
                        empreinte_ac = data_ac.get("empreinte_m2", {}).get("valeur", 0)
                        empreinte_ic = data_ic.get("empreinte_m2", {}).get("valeur", 0)
                        eau_ac = data_ac.get("eau_annuelle", {}).get("valeur", 0)
                        eau_ic = data_ic.get("eau_annuelle", {}).get("valeur", 0)
                        
                        col1.metric("Puissance IT", f"{p_it_kw} kW")
                        col2.metric("Racks (AC ➡️ IC)", f"{racks_ac} ➡️ {racks_ic}", delta=f"{racks_ic - racks_ac} racks", delta_color="inverse")
                        col3.metric("Empreinte (m²)", f"{empreinte_ac} ➡️ {empreinte_ic}", delta=f"{empreinte_ic - empreinte_ac} m²", delta_color="inverse")
                        col4.metric("Eau annuelle (L)", f"{eau_ac:,.0f} ➡️ {eau_ic:,.0f}", delta=f"{eau_ic - eau_ac:,.0f} L", delta_color="inverse")

                    st.divider()

                    # --- POINT 2 & 3 : BAR CHARTS (Énergie & CO2) ---
                    col_graph1, col_graph2 = st.columns(2)
                    with col_graph1:
                        st.subheader("⚡ Énergie par poste (kW)")
                        data_energie = []
                        for res in resultats_filtres:
                            techno = res["techno"]
                            it_kw = res.get("e_it_pure", {}).get("valeur", 0)
                            cooling_kw = res.get("e_refroidissement", {}).get("valeur", 0)
                            totale_kw = res.get("e_totale", {}).get("valeur", 0)
                            data_energie.append({
                                "Technologie": techno, "Énergie IT (kW)": it_kw, 
                                "Refroidissement (kW)": cooling_kw, "Auxiliaires / Overhead (kW)": totale_kw - it_kw - cooling_kw 
                            })
                        if data_energie:
                            df_energie = pd.DataFrame(data_energie).melt(id_vars="Technologie", var_name="Poste", value_name="Puissance (kW)")
                            couleurs = {"Énergie IT (kW)": "#1f77b4", "Refroidissement (kW)": "#ff7f0e", "Auxiliaires / Overhead (kW)": "#7f7f7f"}
                            fig_energie = px.bar(df_energie, x="Technologie", y="Puissance (kW)", color="Poste", barmode="stack", color_discrete_map=couleurs)
                            st.plotly_chart(fig_energie, use_container_width=True)

                    with col_graph2:
                        st.subheader("🌍 Émissions CO2e (t/an)")
                        data_co2 = [{"Technologie": r["techno"], "Mix": r["mix_scenario"], "CO2e": r["co2e_annuel"]["valeur"]} for r in resultats if "co2e_annuel" in r]
                        if data_co2:
                            fig_co2 = px.bar(pd.DataFrame(data_co2), x="Mix", y="CO2e", color="Technologie", barmode="group")
                            st.plotly_chart(fig_co2, use_container_width=True)

                    st.divider()

                    # --- POINT 7 & 8 : NOUVEAUX GRAPHIQUES (ROI et Radar) ---
                    col_graph3, col_graph4 = st.columns(2)
                    
                    with col_graph3:
                        st.subheader("📈 Projection TCO sur 10 ans")
                        # Simulation du coût cumulé : Année 0 = CAPEX. Années suivantes = CAPEX + (OPEX * Année)
                        annees = list(range(11))
                        df_roi = pd.DataFrame({"Année": annees})
                        
                        for res in resultats_filtres:
                            techno = res["techno"]
                            # Si le backend n'envoie pas les coûts exacts, on simule une estimation proportionnelle à l'énergie
                            # Idéalement, à remplacer par les vraies clés du JSON (ex: res["capex_total"]["valeur"])
                            energie_totale = res.get("e_totale", {}).get("valeur", 1000)
                            capex_simule = energie_totale * 1500 if techno == "AC" else energie_totale * 2000
                            opex_simule = energie_totale * 8760 * prix_kwh
                            
                            df_roi[techno] = [capex_simule + (opex_simule * annee) for annee in annees]
                        
                        # Transformation pour Plotly
                        df_roi_melted = df_roi.melt(id_vars="Année", var_name="Technologie", value_name="Coût Cumulé (€)")
                        fig_roi = px.line(df_roi_melted, x="Année", y="Coût Cumulé (€)", color="Technologie", markers=True)
                        st.plotly_chart(fig_roi, use_container_width=True)

                    with col_graph4:
                        st.subheader("🎯 Comparaison Multicritère (Radar)")
                        if data_ac and data_ic:
                            fig_radar = go.Figure()
                            categories = ['PUE', 'CO2e', 'Densité', 'Conso Eau', 'Énergie Totale']
                            
                            for techno, data_tech in [("AC", data_ac), ("IC", data_ic)]:
                                # Normalisation simplifiée (on divise par le max théorique pour ramener entre 0 et 1)
                                valeurs = [
                                    data_tech.get("e_totale", {}).get("inputs", {}).get("pue_typ", 1) / 2, # Max PUE ~ 2
                                    data_tech.get("co2e_annuel", {}).get("valeur", 1) / 10000, 
                                    data_tech.get("nb_racks", {}).get("valeur", 1) / 100,
                                    data_tech.get("eau_annuelle", {}).get("valeur", 0) / 20000,
                                    data_tech.get("e_totale", {}).get("valeur", 1) / 5000
                                ]
                                fig_radar.add_trace(go.Scatterpolar(r=valeurs, theta=categories, fill='toself', name=techno))
                            
                            fig_radar.update_layout(polar=dict(radialaxis=dict(visible=False, range=[0, 1])), showlegend=True)
                            st.plotly_chart(fig_radar, use_container_width=True)
                        else:
                            st.info("Sélectionnez au moins AC et IC pour voir le radar.")

                    st.divider()

                    # --- POINT 5 : RECOMMANDATION IA STREAMÉE (SSE) ---
                    st.subheader("🤖 Analyse et Recommandation de l'IA")
                    st.caption("Généré en temps réel par le backend")
                    
                    # Fonction pour lire le flux de données de l'IA petit à petit
                    def stream_ia():
                        try:
                            # On appelle la route /stream-reco en mode "stream"
                            with requests.post(f"{API_URL}/stream-reco", json=payload, stream=True) as r:
                                for line in r.iter_lines(decode_unicode=True):
                                    if line:
                                        # Nettoyage du format SSE (Server-Sent Events) qui commence souvent par "data:"
                                        texte_propre = line.replace("data: ", "").replace("data:", "")
                                        yield texte_propre + " "
                        except Exception:
                            yield "⚠️ Impossible de se connecter au service d'IA pour le moment."
                    
                    # Affichage "machine à écrire" natif dans Streamlit
                    st.write_stream(stream_ia)

                    st.divider()

                    # --- POINT 4 : HYPOTHÈSES ---
                    st.subheader("📌 Périmètre et Hypothèses")
                    for res in resultats_filtres:
                        with st.expander(f"Voir les détails pour : {res['techno']}"):
                            st.write(f"**Périmètre inclus :** {res.get('e_totale', {}).get('perimetre_inclus', 'N/A')}")
                            st.write(f"**Hypothèse :** {res.get('e_totale', {}).get('hypothese', 'N/A')}")
                            st.caption(f"**Source :** {res.get('e_totale', {}).get('source', 'N/A')}")

            except Exception as e:
                st.error(f"Erreur de connexion lors du calcul : {e}")

# --- POINT 9 : HISTORIQUE DES CALCULS (Tout en bas de la page) ---
st.divider()
st.subheader("🕒 Historique des dernières simulations")
try:
    reponse_history = requests.get(f"{API_URL}/history")
    if reponse_history.status_code == 200:
        historique = reponse_history.json()
        if historique:
            df_history = pd.DataFrame(historique)
            st.dataframe(df_history, use_container_width=True)
        else:
            st.info("Aucune simulation dans l'historique pour le moment.")
except Exception:
    st.warning("Impossible de charger l'historique depuis la base de données.")