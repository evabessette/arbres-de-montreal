use crate::models::Arbre;
use std::collections::HashMap;
use unicode_normalization::UnicodeNormalization;

fn normaliser(texte: &str) -> String {
    texte
        .to_lowercase()
        .nfd()
        .filter(|c| !('\u{0300}'..='\u{036F}').contains(c))
        .collect::<String>()
}

pub(crate) fn rechercher_par_espece<'a>(arbres: &'a [Arbre], recherche: &str) -> Vec<&'a Arbre> {
    let texte_recherche = normaliser(recherche.trim());

    if texte_recherche == "" {
        return arbres.iter().collect();
    }

    // Beaucoup d'arbres partagent la même espèce : chaque nom n'est normalisé qu'une fois.
    let mut especes_vues: HashMap<&str, bool> = HashMap::new();

    arbres
        .iter()
        .filter(|arbre| {
            *especes_vues
                .entry(arbre.essence_fr())
                .or_insert_with(|| normaliser(arbre.essence_fr()).contains(&texte_recherche))
        })
        .collect()
}
