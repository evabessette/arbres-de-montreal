use crate::models::Arbre;
use std::{collections::HashMap, fs, path::Path};

pub fn charger_observations(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let contenu = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if contenu.trim().is_empty() {
        return Ok(HashMap::new());
    }
    serde_json::from_str(&contenu).map_err(|e| format!("observations.json invalide: {e}"))
}

pub fn sauvegarder_observations(
    path: &Path,
    observations: &HashMap<String, String>,
) -> Result<(), String> {
    let contenu = serde_json::to_string_pretty(observations).map_err(|e| e.to_string())?;
    fs::write(path, contenu).map_err(|e| e.to_string())
}

pub fn sauvegarder_observation(
    path: &Path,
    id: String,
    texte: String,
) -> Result<HashMap<String, String>, String> {
    let mut observations = charger_observations(path)?;
    if texte.trim().is_empty() {
        observations.remove(&id);
    } else {
        observations.insert(id, texte.trim().to_string());
    }
    sauvegarder_observations(path, &observations)?;
    Ok(observations)
}

pub fn charger_favoris(path: &Path) -> Result<Vec<String>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let contenu = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if contenu.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&contenu).map_err(|e| format!("favoris.json invalide: {e}"))
}

pub fn sauvegarder_favoris(path: &Path, favoris: &[String]) -> Result<(), String> {
    let contenu = serde_json::to_string_pretty(favoris).map_err(|e| e.to_string())?;
    fs::write(path, contenu).map_err(|e| e.to_string())
}

pub fn ajouter_favori(path: &Path, id: String) -> Result<Vec<String>, String> {
    let mut favoris = charger_favoris(path)?;
    if !favoris.contains(&id) {
        favoris.push(id);
        sauvegarder_favoris(path, &favoris)?;
    }
    Ok(favoris)
}

pub fn retirer_favori(path: &Path, id: &str) -> Result<Vec<String>, String> {
    let mut favoris = charger_favoris(path)?;
    favoris.retain(|favori| favori != id);
    sauvegarder_favoris(path, &favoris)?;
    Ok(favoris)
}

pub fn charger_arbres(path: &Path) -> Result<Vec<Arbre>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let contenu = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if contenu.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&contenu).map_err(|e| format!("arbres.json invalide: {e}"))
}

pub fn sauvegarder_arbres(path: &Path, arbres: &[Arbre]) -> Result<(), String> {
    let contenu = serde_json::to_string_pretty(arbres).map_err(|e| e.to_string())?;
    fs::write(path, contenu).map_err(|e| e.to_string())
}

pub fn importer(path: &Path, nouveaux: Vec<Arbre>, arbres: &mut Vec<Arbre>) -> Result<(), String> {
    sauvegarder_arbres(path, &nouveaux)?;
    *arbres = nouveaux;
    Ok(())
}

pub fn ajouter(path: &Path, mut arbre: Arbre, arbres: &mut Vec<Arbre>) -> Result<Arbre, String> {
    let prochain_id = arbres
        .iter()
        .filter_map(|a| a.id().parse::<u64>().ok())
        .max()
        .unwrap_or(0)
        + 1;
    arbre = Arbre::new(
        prochain_id.to_string(),
        arbre.numero_inventaire(),
        arbre.essence_fr().to_string(),
        arbre.essence_latin().map(str::to_string),
        arbre.arrondissement().to_string(),
        arbre.diametre(),
        arbre.longitude(),
        arbre.latitude(),
        arbre.rue().map(str::to_string),
        arbre.date_plantation().map(str::to_string),
        arbre.arbre_remarquable().map(str::to_string),
    );
    arbres.push(arbre.clone());
    if let Err(e) = sauvegarder_arbres(path, arbres) {
        arbres.pop();
        return Err(e);
    }
    Ok(arbre)
}

pub fn modifier(
    path: &Path,
    id: &str,
    arbre_modifie: Arbre,
    arbres: &mut Vec<Arbre>,
) -> Result<Arbre, String> {
    let position = arbres
        .iter()
        .position(|a| a.id() == id)
        .ok_or("Arbre introuvable.")?;
    let arbre = Arbre::new(
        id.to_string(),
        arbre_modifie.numero_inventaire(),
        arbre_modifie.essence_fr().to_string(),
        arbre_modifie.essence_latin().map(str::to_string),
        arbre_modifie.arrondissement().to_string(),
        arbre_modifie.diametre(),
        arbre_modifie.longitude(),
        arbre_modifie.latitude(),
        arbre_modifie.rue().map(str::to_string),
        arbre_modifie.date_plantation().map(str::to_string),
        arbre_modifie.arbre_remarquable().map(str::to_string),
    );
    let ancien = std::mem::replace(&mut arbres[position], arbre.clone());
    if let Err(e) = sauvegarder_arbres(path, arbres) {
        arbres[position] = ancien;
        return Err(e);
    }
    Ok(arbre)
}

pub fn supprimer(path: &Path, id: &str, arbres: &mut Vec<Arbre>) -> Result<(), String> {
    let position = arbres
        .iter()
        .position(|arbre| arbre.id() == id)
        .ok_or("Arbre introuvable.")?;
    let retire = arbres.remove(position);
    if let Err(e) = sauvegarder_arbres(path, arbres) {
        arbres.insert(position, retire);
        return Err(e);
    }
    Ok(())
}
