# Tests unitaires du calculator — aucune DB requise.
# On vérifie que les formules sont correctes et que
# la traçabilité est bien présente sur chaque mesure.

import math
import pytest
from app.core.calculator import (
    ParamsTechno, ParamsMix, ParamsScenario,
    calc_e_totale, calc_e_refroidissement, calc_e_it_pure,
    calc_eau_annuelle, calc_co2e_annuel, calc_nb_racks,
    calc_empreinte_m2, calc_economie_annuelle, calc_surcout_capex,
    calc_roi, calculer_scenario, calculer_comparatif,
)


@pytest.fixture
def ac():
    return ParamsTechno(
        techno="AC", pue_typ=1.50, pue_min=1.20, pue_max=2.00,
        wue=1.8, cooling_fraction=0.37, capex_index=1.0,
        max_rack_density_kw=20, m2_par_rack=2.0,
        perimetre="Serveurs + Chiller + Ventilation",
        source="Uptime Institute 2023",
    )

@pytest.fixture
def ic():
    return ParamsTechno(
        techno="IC", pue_typ=1.05, pue_min=1.02, pue_max=1.10,
        wue=0.0, cooling_fraction=0.03, capex_index=1.25,
        max_rack_density_kw=100, m2_par_rack=2.0,
        perimetre="Serveurs + Pompes + CDU",
        source="Green Revolution Cooling 2023",
    )

@pytest.fixture
def mix_france():
    return ParamsMix(scenario="Mix Décarboné", pays="France", co2_kwh=50, source="RTE 2023")

@pytest.fixture
def mix_fossile():
    return ParamsMix(scenario="Mix Fossile", pays="Pologne", co2_kwh=600, source="AEE 2023")

@pytest.fixture
def params():
    return ParamsScenario(p_it_kw=50.0, prix_kwh=0.15, heures_annuelles=8760, cout_base_kw=1000.0)


def test_e_totale_ac(ac, params):
    r = calc_e_totale(params.p_it_kw, ac)
    assert r.valeur == pytest.approx(75.0)
    assert r.unite == "kW"
    assert r.source != ""

def test_e_totale_ic(ic, params):
    r = calc_e_totale(params.p_it_kw, ic)
    assert r.valeur == pytest.approx(52.5)

def test_e_refroidissement_ac(ac, params):
    # 50 × (1.50 - 1) × 0.37 = 9.25
    r = calc_e_refroidissement(params.p_it_kw, ac)
    assert r.valeur == pytest.approx(9.25)

def test_e_refroidissement_ic(ic, params):
    # 50 × (1.05 - 1) × 0.03 = 0.075
    r = calc_e_refroidissement(params.p_it_kw, ic)
    assert r.valeur == pytest.approx(0.075)

def test_e_it_pure_identique_entre_technos(params):
    # Règle sujet — P_it identique quelle que soit la techno.
    assert calc_e_it_pure(params.p_it_kw).valeur == params.p_it_kw

def test_eau_ic_zero(ic, params):
    assert calc_eau_annuelle(params.p_it_kw, ic, params.heures_annuelles).valeur == 0.0

def test_eau_ac(ac, params):
    # 50 × 1.8 × 8760 / 1000 = 788.4 m³/an
    r = calc_eau_annuelle(params.p_it_kw, ac, params.heures_annuelles)
    assert r.valeur == pytest.approx(788.4)

def test_co2e_ac_france(ac, mix_france, params):
    # 50 × 1.50 × 8760 × 50 / 1e6 = 32.85 tCO2e/an
    r = calc_co2e_annuel(params.p_it_kw, ac, mix_france, params.heures_annuelles)
    assert r.valeur == pytest.approx(32.85)

def test_co2e_ic_inferieur_ac(ac, ic, mix_france, params):
    r_ac = calc_co2e_annuel(params.p_it_kw, ac, mix_france, params.heures_annuelles)
    r_ic = calc_co2e_annuel(params.p_it_kw, ic, mix_france, params.heures_annuelles)
    assert r_ic.valeur < r_ac.valeur

def test_co2e_fossile_superieur_france(ac, mix_france, mix_fossile, params):
    r_fr = calc_co2e_annuel(params.p_it_kw, ac, mix_france, params.heures_annuelles)
    r_fo = calc_co2e_annuel(params.p_it_kw, ac, mix_fossile, params.heures_annuelles)
    assert r_fo.valeur > r_fr.valeur

def test_nb_racks_ac(ac, params):
    # ceil(50 / 20) = 3
    assert calc_nb_racks(params.p_it_kw, ac).valeur == 3

def test_nb_racks_ic(ic, params):
    # ceil(50 / 100) = 1
    assert calc_nb_racks(params.p_it_kw, ic).valeur == 1

def test_empreinte_m2(ac, params):
    # 3 racks × 2.0 m² = 6.0 m²
    assert calc_empreinte_m2(3, ac).valeur == pytest.approx(6.0)

def test_economie_annuelle(ac, ic, params):
    # (1.50 - 1.05) × 50 × 8760 × 0.15 = 29 565 €/an
    r = calc_economie_annuelle(params.p_it_kw, ac, ic, params)
    assert r.valeur == pytest.approx(29565.0)

def test_surcout_capex(ac, ic, params):
    # 50 × (1.25 - 1.0) × 1000 = 12 500 €
    r = calc_surcout_capex(params.p_it_kw, ac, ic, params)
    assert r.valeur == pytest.approx(12500.0)

def test_roi(ac, ic, params):
    eco = calc_economie_annuelle(params.p_it_kw, ac, ic, params)
    sur = calc_surcout_capex(params.p_it_kw, ac, ic, params)
    roi = calc_roi(eco.valeur, sur.valeur)
    assert roi.valeur == pytest.approx(0.42, abs=0.01)

def test_roi_economie_nulle():
    assert calc_roi(0.0, 10000.0).valeur == float("inf")

def test_ac_sans_roi(ac, mix_france, params):
    r = calculer_scenario("test", params, ac, mix_france, techno_ref=None)
    assert r.roi_annees is None

def test_ic_avec_roi(ac, ic, mix_france, params):
    r = calculer_scenario("test", params, ic, mix_france, techno_ref=ac)
    assert r.roi_annees is not None
    assert r.roi_annees.valeur > 0

def test_comparatif_nb_resultats(ac, ic, mix_france, mix_fossile, params):
    # 2 technos × 2 mix = 4 résultats
    resultats = calculer_comparatif("test", params, [ac, ic], [mix_france, mix_fossile])
    assert len(resultats) == 4

def test_p_it_identique(ac, ic, mix_france, params):
    resultats = calculer_comparatif("test", params, [ac, ic], [mix_france])
    assert len({r.p_it_kw for r in resultats}) == 1

def test_tracabilite_complete(ac, mix_france, params):
    r = calculer_scenario("test", params, ac, mix_france)
    for attr in ["e_totale", "e_refroidissement", "co2e_annuel", "nb_racks", "empreinte_m2", "eau_annuelle"]:
        m = getattr(r, attr)
        assert m.source != "", f"{attr}.source vide"
        assert m.formule != "", f"{attr}.formule vide"
        assert m.perimetre_inclus != "", f"{attr}.perimetre_inclus vide"
