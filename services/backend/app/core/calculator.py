# Bloc métier — fonctions pures de calcul énergétique et carbone.
# Aucune dépendance externe : pas de DB, pas de réseau.
# Chaque fonction retourne une MesureTracee qui embarque
# la valeur + sa traçabilité (formule, périmètre, source).
# C'est ce que le sujet appelle "estimations tracées".

from __future__ import annotations
import math
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class MesureTracee:
    # Résultat d'un calcul avec tout ce qu'il faut pour le justifier.
    valeur: float
    unite: str
    formule: str
    inputs: dict
    perimetre_inclus: str
    perimetre_exclus: str
    hypothese: str
    source: str


@dataclass
class ParamsTechno:
    # Constantes d'une techno lues depuis referentiel_pue en DB.
    techno: str
    pue_typ: float
    pue_min: float
    pue_max: float
    wue: float
    cooling_fraction: float
    capex_index: float
    max_rack_density_kw: int
    m2_par_rack: float
    perimetre: str
    source: str


@dataclass
class ParamsMix:
    # Facteur d'émission CO2e d'un mix électrique.
    scenario: str
    pays: str
    co2_kwh: float
    source: str


@dataclass
class ParamsScenario:
    # Inputs utilisateur ou workload pour un calcul.
    p_it_kw: float
    prix_kwh: float = 0.15
    heures_annuelles: int = 8760
    cout_base_kw: float = 1000.0


@dataclass
class ResultatCalculateur:
    # Ensemble des mesures pour une techno * un mix.
    techno: str
    mix_scenario: str
    p_it_kw: float
    e_totale: MesureTracee
    e_refroidissement: MesureTracee
    e_it_pure: MesureTracee
    eau_annuelle: MesureTracee
    co2e_annuel: MesureTracee
    nb_racks: MesureTracee
    empreinte_m2: MesureTracee
    economie_annuelle: Optional[MesureTracee] = None
    surcout_capex: Optional[MesureTracee] = None
    roi_annees: Optional[MesureTracee] = None

    def to_dict(self) -> dict:
        return asdict(self)


def calc_e_totale(p_it_kw: float, techno: ParamsTechno) -> MesureTracee:
    return MesureTracee(
        valeur=round(p_it_kw * techno.pue_typ, 3),
        unite="kW",
        formule="P_it × PUE",
        inputs={"p_it_kw": p_it_kw, "pue_typ": techno.pue_typ},
        perimetre_inclus=techno.perimetre,
        perimetre_exclus="Éclairage, réseau externe, bureaux, groupes électrogènes",
        hypothese="PUE constant — charge IT stable. Valeur typ = médiane observée.",
        source=techno.source,
    )


def calc_e_refroidissement(p_it_kw: float, techno: ParamsTechno) -> MesureTracee:
    valeur = round(p_it_kw * (techno.pue_typ - 1) * techno.cooling_fraction, 3)
    return MesureTracee(
        valeur=valeur,
        unite="kW",
        formule="P_it × (PUE − 1) × cooling_fraction",
        inputs={"p_it_kw": p_it_kw, "pue_typ": techno.pue_typ, "cooling_fraction": techno.cooling_fraction},
        perimetre_inclus="AC : Chiller + ventilation + ventilateurs rack. IC : Pompes + CDU.",
        perimetre_exclus="UPS, éclairage, sécurité physique",
        hypothese=f"cooling_fraction={techno.cooling_fraction} — ASHRAE TC9.9 (AC) / GRC (IC).",
        source="ASHRAE TC9.9 (2021) / Green Revolution Cooling (2023)",
    )


def calc_e_it_pure(p_it_kw: float) -> MesureTracee:
    # P_it est identique pour toutes les technos 
    return MesureTracee(
        valeur=round(p_it_kw, 3),
        unite="kW",
        formule="P_it (constante)",
        inputs={"p_it_kw": p_it_kw},
        perimetre_inclus="Serveurs, GPU, stockage, réseau interne rack",
        perimetre_exclus="Tout équipement de refroidissement",
        hypothese="Identique entre toutes les technos — règle de comparaison obligatoire.",
        source="Sujet Hackathon Cisco",
    )


def calc_eau_annuelle(p_it_kw: float, techno: ParamsTechno, heures: int = 8760) -> MesureTracee:
    # IC : WUE=0 car circuit fermé, pas d'évaporation.
    valeur = round((p_it_kw * techno.wue * heures) / 1000, 2)
    return MesureTracee(
        valeur=valeur,
        unite="m³/an",
        formule="P_it × WUE × heures / 1000",
        inputs={"p_it_kw": p_it_kw, "wue": techno.wue, "heures": heures},
        perimetre_inclus="Évaporation tours de refroidissement (AC uniquement)",
        perimetre_exclus="Eau sanitaire, nettoyage, eaux pluviales",
        hypothese="IC : WUE=0 circuit fermé. AC : WUE=1.8 L/kWh tours évaporatives.",
        source="Green Revolution Cooling (2023) / The Green Grid WUE",
    )


def calc_co2e_annuel(p_it_kw: float, techno: ParamsTechno, mix: ParamsMix, heures: int = 8760) -> MesureTracee:
    valeur = round((p_it_kw * techno.pue_typ * heures * mix.co2_kwh) / 1e6, 3)
    return MesureTracee(
        valeur=valeur,
        unite="tCO2e/an",
        formule="P_it × PUE × co2_kwh × heures / 1 000 000",
        inputs={"p_it_kw": p_it_kw, "pue_typ": techno.pue_typ, "co2_kwh": mix.co2_kwh, "heures": heures, "mix": mix.scenario},
        perimetre_inclus="Scope 2 — émissions indirectes liées à la consommation électrique",
        perimetre_exclus="Scope 1 (groupes élec., fluides). Scope 3 (fabrication, transport).",
        hypothese=f"Facteur {mix.co2_kwh} gCO2e/kWh — {mix.scenario} ({mix.pays}). GHG Protocol market-based.",
        source=f"GHG Protocol Scope 2 / {mix.source}",
    )


def calc_nb_racks(p_it_kw: float, techno: ParamsTechno) -> MesureTracee:
    valeur = math.ceil(p_it_kw / techno.max_rack_density_kw)
    return MesureTracee(
        valeur=valeur,
        unite="racks",
        formule="ceil(P_it / max_rack_density_kw)",
        inputs={"p_it_kw": p_it_kw, "max_rack_density_kw": techno.max_rack_density_kw},
        perimetre_inclus="Racks IT uniquement",
        perimetre_exclus="Racks réseau, baies de brassage, onduleurs",
        hypothese=f"Densité max {techno.max_rack_density_kw} kW/rack — limite thermique {techno.techno}.",
        source="Nvidia DGX H100 specs (2023) / TIA-942",
    )


def calc_empreinte_m2(nb_racks: int, techno: ParamsTechno) -> MesureTracee:
    return MesureTracee(
        valeur=round(nb_racks * techno.m2_par_rack, 2),
        unite="m²",
        formule="nb_racks × m2_par_rack",
        inputs={"nb_racks": nb_racks, "m2_par_rack": techno.m2_par_rack},
        perimetre_inclus="Surface rack + allées de service chaud/froid",
        perimetre_exclus="Locaux techniques, bureaux, onduleurs",
        hypothese=f"m2_par_rack={techno.m2_par_rack} m² — layout TIA-942.",
        source="TIA-942 Telecommunications Infrastructure Standard",
    )


def calc_economie_annuelle(p_it_kw: float, techno_ref: ParamsTechno, techno_cible: ParamsTechno, params: ParamsScenario) -> MesureTracee:
    delta_kw = (techno_ref.pue_typ - techno_cible.pue_typ) * p_it_kw
    valeur = round(delta_kw * params.heures_annuelles * params.prix_kwh, 2)
    return MesureTracee(
        valeur=valeur,
        unite="€/an",
        formule="(PUE_AC − PUE_IC) × P_it × heures × prix_kwh",
        inputs={"pue_ac": techno_ref.pue_typ, "pue_ic": techno_cible.pue_typ, "p_it_kw": p_it_kw, "prix_kwh": params.prix_kwh},
        perimetre_inclus="Économie sur facture électrique — énergie uniquement",
        perimetre_exclus="Maintenance, personnel, réseau, licences",
        hypothese=f"prix_kwh={params.prix_kwh} €/kWh — Eurostat B2B 2023.",
        source="Eurostat — Electricity prices non-household 2023",
    )


def calc_surcout_capex(p_it_kw: float, techno_ref: ParamsTechno, techno_cible: ParamsTechno, params: ParamsScenario) -> MesureTracee:
    valeur = round(p_it_kw * (techno_cible.capex_index - techno_ref.capex_index) * params.cout_base_kw, 2)
    return MesureTracee(
        valeur=valeur,
        unite="€",
        formule="P_it × (capex_IC − capex_AC) × cout_base_kw",
        inputs={"capex_ic": techno_cible.capex_index, "capex_ac": techno_ref.capex_index, "cout_base_kw": params.cout_base_kw},
        perimetre_inclus="Surcoût matériel infrastructure refroidissement",
        perimetre_exclus="Intégration, formation, migration, downtime",
        hypothese=f"capex_index IC={techno_cible.capex_index}. cout_base_kw={params.cout_base_kw} €/kW.",
        source="Uptime Institute — Data Center Cost per kW 2023",
    )


def calc_roi(economie_annuelle: float, surcout_capex: float) -> MesureTracee:
    valeur = float("inf") if economie_annuelle <= 0 else round(surcout_capex / economie_annuelle, 2)
    return MesureTracee(
        valeur=valeur,
        unite="années",
        formule="surcout_capex / economie_annuelle",
        inputs={"surcout_capex": surcout_capex, "economie_annuelle": economie_annuelle},
        perimetre_inclus="ROI énergétique pur — payback period simple",
        perimetre_exclus="VAN, TRI, actualisation. Évolution prix énergie.",
        hypothese="ROI simple non actualisé. Typique IC : 3–5 ans.",
        source="Hypothèse financière interne",
    )


def calculer_scenario(
    scenario_name: str,
    params: ParamsScenario,
    techno: ParamsTechno,
    mix: ParamsMix,
    techno_ref: Optional[ParamsTechno] = None,
) -> ResultatCalculateur:
    # ROI et économie seulement si on compare à une référence AC.
    nb_racks_res = calc_nb_racks(params.p_it_kw, techno)
    economie = surcout = roi = None
    if techno_ref and techno.techno != techno_ref.techno:
        economie = calc_economie_annuelle(params.p_it_kw, techno_ref, techno, params)
        surcout  = calc_surcout_capex(params.p_it_kw, techno_ref, techno, params)
        roi      = calc_roi(economie.valeur, surcout.valeur)

    return ResultatCalculateur(
        techno=techno.techno,
        mix_scenario=mix.scenario,
        p_it_kw=params.p_it_kw,
        e_totale=calc_e_totale(params.p_it_kw, techno),
        e_refroidissement=calc_e_refroidissement(params.p_it_kw, techno),
        e_it_pure=calc_e_it_pure(params.p_it_kw),
        eau_annuelle=calc_eau_annuelle(params.p_it_kw, techno, params.heures_annuelles),
        co2e_annuel=calc_co2e_annuel(params.p_it_kw, techno, mix, params.heures_annuelles),
        nb_racks=nb_racks_res,
        empreinte_m2=calc_empreinte_m2(int(nb_racks_res.valeur), techno),
        economie_annuelle=economie,
        surcout_capex=surcout,
        roi_annees=roi,
    )


def calculer_comparatif(
    scenario_name: str,
    params: ParamsScenario,
    technos: list[ParamsTechno],
    mix_list: list[ParamsMix],
) -> list[ResultatCalculateur]:
    # Lance le calcul pour toutes les combinaisons techno × mix.
    # P_it est identique pour toutes 
    techno_ref = next((t for t in technos if t.techno == "AC"), None)
    return [
        calculer_scenario(scenario_name, params, techno, mix,
                          techno_ref if techno.techno != "AC" else None)
        for mix in mix_list
        for techno in technos
    ]
