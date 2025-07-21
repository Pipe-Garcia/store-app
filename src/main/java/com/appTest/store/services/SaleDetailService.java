package com.appTest.store.services;

import com.appTest.store.dto.saleDetail.MaterialMostSoldDTO;
import com.appTest.store.dto.saleDetail.SaleDetailDTO;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.repositories.ISaleDetailRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class SaleDetailService implements ISaleDetailService{

    @Autowired
    private ISaleDetailRepository repoSaleDetail;

    @Override
    public List<SaleDetail> getAllSaleDetail() {
        return repoSaleDetail.findAll();
    }

    @Override
    public SaleDetail getSaleDetailById(Long idSaleDetail) {
        return repoSaleDetail.findById(idSaleDetail).orElse(null);
    }

    @Override
    public SaleDetailDTO convertSaleDetailToDto(SaleDetail saleDetail) {

        BigDecimal quantityMat = saleDetail.getQuantity();
        BigDecimal priceMat = saleDetail.getPriceUni();
        String nameMat = saleDetail.getMaterial().getName();

        return new SaleDetailDTO(
                saleDetail.getIdSaleDetail(),
                priceMat,
                nameMat,
                quantityMat
        );
    }

    @Override
    public MaterialMostSoldDTO getMostSoldMaterial() {
        List<MaterialMostSoldDTO> result = repoSaleDetail.getMostSoldMaterial(PageRequest.of(0, 1));
        return result.isEmpty() ? null : result.get(0);
    }


    @Override
    @Transactional
    public boolean deleteSaleDetailById(Long idSaleDetail) {
        SaleDetail saleDetail = repoSaleDetail.findById(idSaleDetail).orElse(null);
        if (saleDetail != null) {
            repoSaleDetail.deleteById(idSaleDetail);
            return true;
        }
        return false;
    }
}
